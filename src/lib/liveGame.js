import { supabase } from './supabase'

async function currentUserId() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id ?? null
}

// Legt ein Online-Spiel an (Host + Lobby). RPC gibt { id, join_code } zurück.
export async function createGame(mode = 'normal') {
  const { data, error } = await supabase.rpc('create_live_game', {
    p_mode: mode,
  })
  if (error) throw error
  return data // { id, join_code }
}

// Tritt einem Lobby-Spiel per Code bei. RPC gibt { id } zurück oder wirft.
export async function joinByCode(code) {
  const { data, error } = await supabase.rpc('join_live_game', {
    p_code: code.trim().toUpperCase(),
  })
  if (error) throw error
  return data // { id }
}

// Vollständiger Zustand: Spiel + Spieler (mit Namen) + alle Zellen.
export async function fetchGame(gameId) {
  const [gameRes, playersRes, scoresRes] = await Promise.all([
    supabase
      .from('live_games')
      .select('id, mode, host_id, join_code, status, current_turn')
      .eq('id', gameId)
      .single(),
    supabase
      .from('live_players')
      .select('profile_id, seat, profiles(display_name)')
      .eq('game_id', gameId)
      .order('seat'),
    supabase
      .from('live_scores')
      .select('profile_id, category_index, value, is_kniffel')
      .eq('game_id', gameId),
  ])
  if (gameRes.error) throw gameRes.error

  return {
    game: gameRes.data,
    players: (playersRes.data ?? []).map((p) => ({
      profileId: p.profile_id,
      seat: p.seat,
      name: p.profiles?.display_name ?? '?',
    })),
    scores: scoresRes.data ?? [],
  }
}

// Einen Zug spielen: setzt EINE Zelle und schaltet den Zug weiter. Die RPC
// erzwingt serverseitig die Reihenfolge (nur wer dran ist, keine Doppel-Einträge).
export async function playTurn(gameId, categoryIndex, value, isKniffel = false) {
  const { error } = await supabase.rpc('play_turn', {
    p_game: gameId,
    p_cat: categoryIndex,
    p_value: value,
    p_is_kniffel: isKniffel,
  })
  if (error) throw error
}

// Reihenfolge festlegen (nur Host, nur in der Lobby). orderedIds = profile-IDs.
export async function reorderPlayers(gameId, orderedIds) {
  const { error } = await supabase.rpc('reorder_players', {
    p_game: gameId,
    p_order: orderedIds,
  })
  if (error) throw error
}

// Spiel starten: erster Sitz (0) beginnt.
export async function startGame(gameId) {
  const { error } = await supabase
    .from('live_games')
    .update({ status: 'playing', current_turn: 0 })
    .eq('id', gameId)
  if (error) throw error
}

export async function setStatus(gameId, status) {
  const { error } = await supabase
    .from('live_games')
    .update({ status })
    .eq('id', gameId)
  if (error) throw error
}

export async function leaveGame(gameId) {
  const uid = await currentUserId()
  if (!uid) return
  await supabase
    .from('live_players')
    .delete()
    .eq('game_id', gameId)
    .eq('profile_id', uid)
}

// Realtime: ruft onChange bei jeder Änderung an Spiel/Spielern/Scores auf.
// Postgres Changes respektiert die RLS der Tabellen.
export function subscribeGame(gameId, onChange) {
  // Eindeutiger Topic-Name: Lobby und Spielbildschirm abonnieren dasselbe Spiel
  // gleichzeitig — mit gleichem Namen würden sich die Channels blockieren.
  const channel = supabase.channel(`live:${gameId}:${Math.random().toString(16).slice(2)}`)
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'live_games', filter: `id=eq.${gameId}` },
    onChange,
  )
  for (const table of ['live_players', 'live_scores']) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `game_id=eq.${gameId}` },
      onChange,
    )
  }
  channel.subscribe()
  return () => supabase.removeChannel(channel)
}
