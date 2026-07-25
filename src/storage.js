import { supabase, isSupabaseConfigured } from './lib/supabase'

const CACHE_KEY = 'kniffel-cache-v2'
const LEGACY_KEY = 'kniffel-history'
const IMPORTED_KEY = 'kniffel-legacy-imported'

// Ein Spiel im Cache:
// { clientId, mode, playedAt, createdBy, synced, participants: [
//     { profileId|null, guestName|null, name, finalScore, isWinner, kniffelCount }
//   ] }

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? []
  } catch {
    return []
  }
}

function writeCache(games) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(games))
}

function markSynced(clientId) {
  writeCache(
    readCache().map((g) =>
      g.clientId === clientId ? { ...g, synced: true } : g,
    ),
  )
}

async function currentUserId() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data?.user?.id ?? null
}

// Wie currentUserId(), aber rein LOKAL (liest die gespeicherte Session, kein
// Netz). Für den Schreibpfad, der offline nie hängen darf. createdBy ist nur
// ein Hinweis — pushGame/syncPending bestimmen die User-ID sowieso neu.
async function localUserId() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getSession()
  return data?.session?.user?.id ?? null
}

// --- Schreiben -------------------------------------------------------------

// Schreibt sofort lokal (offline-fest) und schiebt danach best-effort in die Cloud.
export async function saveGame({
  mode,
  players = [],
  identities = [],
  finalScores = [],
  kniffelCounts = [],
  isWinners = [],
  cells = [], // pro Spieler das Kategorie-Raster; nur der Normal-Modus liefert es
}) {
  const uid = await localUserId()

  const participants = players.map((name, i) => {
    const profileId = identities[i] ?? null
    return {
      profileId,
      guestName: profileId ? null : name,
      name,
      finalScore: finalScores[i] ?? 0,
      isWinner: Boolean(isWinners[i]),
      kniffelCount: kniffelCounts[i] ?? 0,
      cells: cells[i] ?? null,
    }
  })

  const game = {
    clientId: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    mode,
    playedAt: new Date().toISOString(),
    createdBy: uid,
    synced: false,
    participants,
  }

  // Sofort lokal sichern — ab hier ist das Spiel offline-fest gespeichert.
  writeCache([...readCache(), game])
  emitSaved()

  // Cloud-Push best-effort im HINTERGRUND: bewusst NICHT awaited, damit die UI
  // nie am Netz hängt. Klappt es nicht (offline/RLS), bleibt das Spiel in der
  // Queue und syncPending() schiebt es später nach.
  pushGame(game).catch(() => {})
  return game
}

// --- Save-Event (für den Toaster) ------------------------------------------

const saveListeners = new Set()

// Meldet sich für "ein Spiel wurde lokal gespeichert" an. Gibt eine
// Abmelde-Funktion zurück.
export function onSaveEvent(cb) {
  saveListeners.add(cb)
  return () => saveListeners.delete(cb)
}

function emitSaved() {
  for (const cb of saveListeners) cb()
}

async function pushGame(game) {
  const uid = await currentUserId()
  if (!uid) return false // Gast -> nur lokal

  // Idempotenz: schon gepusht?
  const { data: existing } = await supabase
    .from('games')
    .select('id')
    .eq('created_by', uid)
    .eq('client_id', game.clientId)
    .maybeSingle()
  if (existing) {
    markSynced(game.clientId)
    return true
  }

  const { data: row, error } = await supabase
    .from('games')
    .insert({
      client_id: game.clientId,
      mode: game.mode,
      created_by: uid,
      played_at: game.playedAt,
    })
    .select('id')
    .single()
  if (error) throw error

  const rows = game.participants.map((p) => ({
    game_id: row.id,
    profile_id: p.profileId,
    guest_name: p.profileId ? null : (p.guestName ?? p.name),
    final_score: p.finalScore,
    is_winner: p.isWinner,
    kniffel_count: p.kniffelCount,
    cells: p.cells ?? null,
  }))
  const { error: playersError } = await supabase
    .from('game_players')
    .insert(rows)
  if (playersError) throw playersError

  markSynced(game.clientId)
  return true
}

export async function syncPending() {
  const uid = await currentUserId()
  if (!uid) return 0
  let pushed = 0
  for (const game of readCache().filter((g) => !g.synced)) {
    try {
      if (await pushGame({ ...game, createdBy: uid })) pushed++
    } catch {
      // offline / RLS -> beim nächsten Versuch
    }
  }
  return pushed
}

// --- Lesen -----------------------------------------------------------------

async function fetchCloudGames() {
  const uid = await currentUserId()
  if (!uid) return null

  // RLS liefert nur Zeilen aus Spielen, die ich sehen darf.
  const { data, error } = await supabase
    .from('game_players')
    .select(
      'game_id, profile_id, guest_name, final_score, is_winner, kniffel_count, cells, games(mode, played_at), profiles(display_name)',
    )
  if (error) throw error

  const byGame = new Map()
  for (const r of data ?? []) {
    if (!byGame.has(r.game_id)) {
      byGame.set(r.game_id, {
        id: r.game_id,
        mode: r.games?.mode,
        playedAt: r.games?.played_at,
        participants: [],
      })
    }
    byGame.get(r.game_id).participants.push({
      profileId: r.profile_id,
      name: r.profiles?.display_name ?? r.guest_name,
      finalScore: r.final_score,
      isWinner: r.is_winner,
      kniffelCount: r.kniffel_count,
      cells: r.cells ?? null,
    })
  }
  return [...byGame.values()]
}

export async function getHistory() {
  const uid = await currentUserId()
  let games = []
  try {
    const cloud = await fetchCloudGames()
    if (cloud) games = cloud
  } catch {
    // offline -> nur lokal
  }
  // Eingeloggt: nur noch nicht gepushte Spiele ergänzen. Gast: alle lokalen.
  const local = readCache()
    .filter((g) => !uid || !g.synced)
    .map((g) => ({
      id: g.clientId,
      mode: g.mode,
      playedAt: g.playedAt,
      participants: g.participants,
    }))
  return [...games, ...local]
}

function keyOf(p) {
  return p.profileId ? `p:${p.profileId}` : `g:${(p.name ?? '').toLowerCase()}`
}

export async function getPlayerStats() {
  const games = await getHistory()
  const stats = {}

  function ensure(key, name) {
    if (!stats[key]) {
      stats[key] = {
        id: key,
        name,
        isAccount: key.startsWith('p:'),
        gamesPlayed: 0,
        wins: 0,
        totalKniffel: 0,
        totalGamesWithKniffel: 0,
        opponents: {},
      }
    } else if (name) {
      stats[key].name = name
    }
  }

  for (const game of games) {
    const participants = game.participants ?? []
    participants.forEach((p) => ensure(keyOf(p), p.name))

    participants.forEach((p) => {
      const s = stats[keyOf(p)]
      s.gamesPlayed++

      const kniffel = p.kniffelCount ?? 0
      s.totalKniffel += kniffel
      if (kniffel > 0) s.totalGamesWithKniffel++
      if (p.isWinner) s.wins++

      participants.forEach((o) => {
        if (o === p) return
        const name = o.name ?? '?'
        if (!s.opponents[name]) {
          s.opponents[name] = { played: 0, won: 0, lost: 0 }
        }
        s.opponents[name].played++
        if (p.isWinner) s.opponents[name].won++
        else s.opponents[name].lost++
      })
    })
  }

  return stats
}

export function clearHistory() {
  localStorage.removeItem(CACHE_KEY)
}

// --- Einmaliger Import der alten localStorage-Historie ----------------------

export async function importLegacyHistory(profile) {
  if (localStorage.getItem(IMPORTED_KEY) === '1') return 0

  let legacy = []
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_KEY)) ?? []
  } catch {
    legacy = []
  }
  if (!legacy.length) {
    localStorage.setItem(IMPORTED_KEY, '1')
    return 0
  }

  const myName = profile?.display_name?.trim().toLowerCase()
  const imported = legacy.map((g) => {
    const players = g.players ?? []
    const totals = players.map((_, i) => {
      if (g.mode === 'extrem') {
        const s = g.scores?.[i] ?? {}
        return (
          (s.topDown?.[14]?.value ?? 0) +
          (s.bottomUp?.[14]?.value ?? 0) +
          (s.normal?.[14]?.value ?? 0)
        )
      }
      return g.scores?.[i]?.[14]?.value ?? 0
    })

    return {
      clientId: `legacy-${g.id}`,
      mode: g.mode ?? 'normal',
      playedAt: g.date ?? new Date().toISOString(),
      createdBy: profile?.id ?? null,
      synced: false,
      participants: players.map((name, i) => {
        const mine = Boolean(myName) && name.trim().toLowerCase() === myName
        return {
          profileId: mine ? profile.id : null,
          guestName: mine ? null : name,
          name,
          finalScore: totals[i] ?? 0,
          isWinner: (g.winners ?? []).includes(name),
          kniffelCount: g.kniffelCounts?.[i] ?? 0,
        }
      }),
    }
  })

  const existing = new Set(readCache().map((g) => g.clientId))
  writeCache([
    ...readCache(),
    ...imported.filter((g) => !existing.has(g.clientId)),
  ])
  localStorage.setItem(IMPORTED_KEY, '1')

  try {
    await syncPending()
  } catch {
    // später
  }
  return imported.length
}
