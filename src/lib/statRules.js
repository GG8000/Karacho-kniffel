// Speicher für die Statistik-Regeln (zusammenlegen / ausblenden).
//
// Angemeldet liegen sie in Supabase und gelten damit auf jedem Gerät — siehe
// sql/stat_rules.sql, das einmal im SQL-Editor laufen muss. Zusätzlich landet
// jeder geladene Stand in localStorage: Offline soll die Statistik nicht
// plötzlich wieder alle ausgeblendeten Spieler zeigen.
//
// Als Gast gibt es nur den localStorage-Pfad. Ohne Konto ist nichts da, woran
// eine geräteübergreifende Regel hängen könnte.

import { supabase, isSupabaseConfigured } from './supabase'
import { resolveKey } from '../logic/applyStatRules'

const CACHE_KEY = 'kniffel-stat-rules-v1'

export const EMPTY_RULES = { merges: {}, hidden: [] }

function readCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY))
    if (!parsed) return EMPTY_RULES
    return { merges: parsed.merges ?? {}, hidden: parsed.hidden ?? [] }
  } catch {
    return EMPTY_RULES
  }
}

function writeCache(rules) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rules))
  } catch {
    // Privater Modus / voller Speicher — die Regeln bleiben dann nur für diese
    // Sitzung im React-State, und das ist kein Grund, irgendetwas abzubrechen.
  }
}

async function currentUserId() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data?.user?.id ?? null
}

function toRules(rows) {
  const merges = {}
  const hidden = []
  for (const r of rows ?? []) {
    if (r.hidden) hidden.push(r.player_key)
    else if (r.merge_into) merges[r.player_key] = r.merge_into
  }
  return { merges, hidden }
}

export async function loadStatRules() {
  const uid = await currentUserId()
  if (!uid) return readCache()

  try {
    const { data, error } = await supabase
      .from('stat_rules')
      .select('player_key, merge_into, hidden')
    if (error) throw error
    const rules = toRules(data)
    writeCache(rules)
    return rules
  } catch {
    // Offline oder Tabelle noch nicht angelegt -> letzter bekannter Stand.
    return readCache()
  }
}

// Legt `playerKey` in `targetKey` — beide im keyOf()-Format aus logic/stats.js.
export async function mergePlayer(playerKey, targetKey, current = EMPTY_RULES) {
  if (playerKey === targetKey) {
    throw new Error('Ein Spieler kann nicht in sich selbst aufgehen.')
  }
  // Würde das Ziel über bestehende Regeln wieder auf den Spieler zeigen, ent-
  // stünde ein Kreis. applyStatRules bricht ihn zwar ab, aber das Ergebnis wäre
  // für niemanden vorhersagbar — also gar nicht erst zulassen.
  if (resolveKey(targetKey, current.merges) === playerKey) {
    throw new Error('Das würde die beiden im Kreis aufeinander zeigen lassen.')
  }
  return writeRule({ player_key: playerKey, merge_into: targetKey, hidden: false })
}

export async function hidePlayer(playerKey) {
  return writeRule({ player_key: playerKey, merge_into: null, hidden: true })
}

// Angemeldet MUSS die Cloud den Schreibvorgang bestätigen, bevor die Regel
// lokal gilt. Sonst entstünde genau die Zwitterlage, die man später nicht mehr
// versteht: In der Anzeige ein Fehler, in localStorage aber schon die neue
// Regel — und beim nächsten Start wäre sie plötzlich da. Regeln ändert man
// selten und bewusst; dafür ist ein ehrliches "geht gerade nicht" besser als
// ein stiller Sonderzustand.
async function writeRule(rule) {
  const uid = await currentUserId()

  if (uid) {
    const { error } = await supabase.from('stat_rules').upsert(
      { ...rule, user_id: uid, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,player_key' },
    )
    if (error) throw new Error(describe(error))
  }

  return applyToCache(rule)
}

export async function clearRule(playerKey) {
  const uid = await currentUserId()

  if (uid) {
    const { error } = await supabase
      .from('stat_rules')
      .delete()
      .eq('user_id', uid)
      .eq('player_key', playerKey)
    if (error) throw new Error(describe(error))
  }

  const cached = readCache()
  const merges = { ...cached.merges }
  delete merges[playerKey]
  const next = { merges, hidden: cached.hidden.filter((k) => k !== playerKey) }
  writeCache(next)
  return next
}

// Die häufigste Ursache ist, dass sql/stat_rules.sql noch nie gelaufen ist.
// PostgREST meldet das als PGRST205 bzw. 42P01 — ohne Übersetzung stünde da
// nur "schema cache", womit niemand etwas anfangen kann.
function describe(error) {
  const code = error?.code ?? ''
  if (code === 'PGRST205' || code === '42P01') {
    return 'Die Tabelle stat_rules fehlt — sql/stat_rules.sql muss einmal im Supabase-SQL-Editor laufen.'
  }
  return error?.message ?? 'Regel konnte nicht gespeichert werden.'
}

// Den lokalen Stand nachziehen: Er ist der Offline-Puffer für loadStatRules().
function applyToCache(rule) {
  const cached = readCache()
  const merges = { ...cached.merges }
  const hidden = cached.hidden.filter((k) => k !== rule.player_key)
  delete merges[rule.player_key]

  if (rule.hidden) hidden.push(rule.player_key)
  else if (rule.merge_into) merges[rule.player_key] = rule.merge_into

  const next = { merges, hidden }
  writeCache(next)
  return next
}
