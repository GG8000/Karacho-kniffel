// Reihenfolge-Statistik für den NORMAL-Modus: in welcher Reihenfolge trägt ein
// Spieler die Kategorien ein?
//
// Datenquelle sind dieselben Spiele wie in stats.js (aus getHistory()), aber es
// zählen nur Spiele, deren cells ein `turn` tragen. Das wird erst seit der
// Einführung der Zugreihenfolge mitgespeichert — ältere Spiele fehlen hier
// zwangsläufig und werden übersprungen.

import { keyOf } from './stats'

export const ORDER_INDICES = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13]

function emptyEntry() {
  return {
    gamesWithOrder: 0,
    turnSum: {}, // cIdx -> Summe der Positionen
    turnCount: {}, // cIdx -> wie oft gespielt
    firstCount: {}, // cIdx -> wie oft als Eröffnung
    lastCount: {}, // cIdx -> wie oft als Abschluss
    pairs: {}, // "lo>hi" -> { before, total }; before = lo kam vor hi
  }
}

// Trägt die Reihenfolge EINES Spielers aus EINEM Spiel in den Akkumulator ein.
// order ist bereits nach turn sortiert.
function accumulate(entry, order) {
  entry.gamesWithOrder++

  order.forEach((ci, i) => {
    entry.turnSum[ci] = (entry.turnSum[ci] ?? 0) + (i + 1)
    entry.turnCount[ci] = (entry.turnCount[ci] ?? 0) + 1
  })
  const first = order[0]
  const last = order[order.length - 1]
  entry.firstCount[first] = (entry.firstCount[first] ?? 0) + 1
  entry.lastCount[last] = (entry.lastCount[last] ?? 0) + 1

  // Alle Paare: wer kam vor wem? Normalisiert auf lo<hi, damit jedes Paar
  // genau einen Eintrag hat.
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      const a = order[i] // a kam vor b
      const b = order[j]
      const lo = Math.min(a, b)
      const hi = Math.max(a, b)
      const rec = (entry.pairs[`${lo}>${hi}`] ??= { before: 0, total: 0 })
      rec.total++
      if (a === lo) rec.before++
    }
  }
}

function finalize(raw) {
  const avgTurn = {}
  const firstRate = {}
  const lastRate = {}
  for (const ci of ORDER_INDICES) {
    if (raw.turnCount[ci]) avgTurn[ci] = raw.turnSum[ci] / raw.turnCount[ci]
    if (raw.gamesWithOrder) {
      firstRate[ci] = (raw.firstCount[ci] ?? 0) / raw.gamesWithOrder
      lastRate[ci] = (raw.lastCount[ci] ?? 0) / raw.gamesWithOrder
    }
  }
  const ranked = ORDER_INDICES.filter((ci) => avgTurn[ci] != null).sort(
    (a, b) => avgTurn[a] - avgTurn[b],
  )
  return {
    gamesWithOrder: raw.gamesWithOrder,
    avgTurn,
    firstRate,
    lastRate,
    ranked,
    pairs: raw.pairs,
  }
}

// Haupt-Aggregat. Gibt { [playerKey]: entry, __global: entry } zurück.
export function computeOrderStats(games) {
  const raw = { __global: emptyEntry() }

  for (const game of games ?? []) {
    if (game.mode !== 'normal') continue
    for (const p of game.participants ?? []) {
      const cells = p.cells
      if (!cells || typeof cells !== 'object') continue

      const played = ORDER_INDICES.filter(
        (ci) => cells[ci] != null && Number.isFinite(cells[ci].turn),
      )
      // Unter zwei Feldern gibt es keine Reihenfolge zu messen.
      if (played.length < 2) continue

      const order = [...played].sort((a, b) => cells[a].turn - cells[b].turn)
      accumulate((raw[keyOf(p)] ??= emptyEntry()), order)
      accumulate(raw.__global, order)
    }
  }

  const out = {}
  for (const key of Object.keys(raw)) out[key] = finalize(raw[key])
  return out
}

// Wie oft kam Kategorie a vor Kategorie b? null, wenn es dazu keine Spiele gibt.
export function pairRate(entry, a, b) {
  if (!entry || a === b) return null
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const rec = entry.pairs?.[`${lo}>${hi}`]
  if (!rec?.total) return null
  const before = a === lo ? rec.before : rec.total - rec.before
  return { before, total: rec.total, rate: before / rec.total }
}

// Die ausgeprägtesten Gewohnheiten: Paare, die am eindeutigsten immer in
// derselben Richtung gespielt werden. Jeweils schon so gedreht, dass a vor b kam.
export function strongestHabits(entry, { minGames = 3, limit = 5 } = {}) {
  if (!entry?.pairs) return []
  const out = []
  for (const [k, rec] of Object.entries(entry.pairs)) {
    if (rec.total < minGames) continue
    const [lo, hi] = k.split('>').map(Number)
    const rate = rec.before / rec.total
    // Immer die dominante Richtung zeigen.
    out.push(
      rate >= 0.5
        ? { a: lo, b: hi, rate, total: rec.total }
        : { a: hi, b: lo, rate: 1 - rate, total: rec.total },
    )
  }
  return out
    .sort((x, y) => y.rate - x.rate || y.total - x.total)
    .slice(0, limit)
}
