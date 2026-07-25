// Kategorie-Statistiken für den NORMAL-Modus: was ein Spieler je Kategorie
// tatsächlich einträgt (Ø, Median, Verteilung, Streich-/Trefferquote, Vorbonus).
//
// Datenquelle sind dieselben Spiele wie in stats.js (aus getHistory()), aber es
// zählen nur Spiele mit game.mode === 'normal' UND vorhandenem participant.cells.
//
// cells = { [cIdx]: { value, isKniffel } } für die Spielindizes (0-5, 7-13).

import { keyOf } from './stats'
import { calculateUpperAbsolutePoints } from './calculator'

export const UPPER_INDICES = [0, 1, 2, 3, 4, 5]
export const SLIDER_INDICES = [7, 8, 13] // 3er, 4er, Chance
export const FIXED_INDICES = [9, 10, 11, 12] // FH, kl. Str, gr. Str, Kniffel
const ALL_INDICES = [...UPPER_INDICES, ...SLIDER_INDICES, ...FIXED_INDICES]

// Rohen Zellwert in eine auswertbare Kennzahl übersetzen.
// - oberer Teil: metric = Würfelanzahl (0..5); Balance zurückrechnen
// - Slider/Fest: metric = eingetragene Augensumme/Punkte
export function decodeCell(cIdx, value) {
  if (UPPER_INDICES.includes(cIdx)) {
    const face = cIdx + 1
    const count = Math.max(0, Math.min(5, Math.round(value / face + 3)))
    return { kind: 'upper', metric: count, struck: count === 0 }
  }
  if (SLIDER_INDICES.includes(cIdx)) {
    return { kind: 'slider', metric: value, struck: value === 0 }
  }
  return { kind: 'fixed', metric: value, struck: value === 0 }
}

function median(values) {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function emptyEntry() {
  return { gamesWithCells: 0, bonusGames: 0, cats: {} }
}

function emptyCat() {
  return { count: 0, strikes: 0, sum: 0, values: [], dist: [0, 0, 0, 0, 0, 0] }
}

// Trägt eine gespielte Zelle in einen Akkumulator ein.
function accumulate(entry, cIdx, value) {
  const cat = (entry.cats[cIdx] ??= emptyCat())
  const { kind, metric, struck } = decodeCell(cIdx, value)
  cat.count++
  if (struck) cat.strikes++
  if (kind === 'upper') {
    cat.sum += metric
    cat.dist[metric]++
  } else if (kind === 'slider' && !struck) {
    cat.values.push(metric)
  }
}

function finalizeCat(cIdx, cat) {
  if (!cat) return null
  const strikeRate = cat.count ? cat.strikes / cat.count : 0
  if (UPPER_INDICES.includes(cIdx)) {
    return {
      kind: 'upper',
      count: cat.count,
      strikeRate,
      avgCount: cat.count ? cat.sum / cat.count : 0,
      dist: cat.dist,
    }
  }
  if (SLIDER_INDICES.includes(cIdx)) {
    return {
      kind: 'slider',
      count: cat.count,
      strikeRate,
      avg: cat.values.length
        ? cat.values.reduce((a, b) => a + b, 0) / cat.values.length
        : 0,
      median: median(cat.values),
      max: cat.values.length ? Math.max(...cat.values) : 0,
      values: cat.values,
    }
  }
  return {
    kind: 'fixed',
    count: cat.count,
    strikeRate,
    hits: cat.count - cat.strikes,
    hitRate: cat.count ? (cat.count - cat.strikes) / cat.count : 0,
  }
}

function finalizeEntry(raw) {
  const cats = {}
  for (const ci of ALL_INDICES) {
    const f = finalizeCat(ci, raw.cats[ci])
    if (f) cats[ci] = f
  }
  return {
    gamesWithCells: raw.gamesWithCells,
    bonusRate: raw.gamesWithCells ? raw.bonusGames / raw.gamesWithCells : 0,
    cats,
  }
}

// Haupt-Aggregat. Gibt { [playerKey]: entry, __global: entry } zurück.
export function computeCategoryStats(games) {
  const raw = { __global: emptyEntry() }

  for (const game of games ?? []) {
    if (game.mode !== 'normal') continue
    for (const p of game.participants ?? []) {
      const cells = p.cells
      if (!cells || typeof cells !== 'object') continue

      const key = keyOf(p)
      const entry = (raw[key] ??= emptyEntry())
      const global = raw.__global

      entry.gamesWithCells++
      global.gamesWithCells++

      for (const [ci, cell] of Object.entries(cells)) {
        const cIdx = Number(ci)
        if (!ALL_INDICES.includes(cIdx) || cell == null) continue
        accumulate(entry, cIdx, cell.value ?? 0)
        accumulate(global, cIdx, cell.value ?? 0)
      }

      // Vorbonus: oberer Teil ≥ 63 Absolutpunkte
      const upper = {}
      for (const ci of UPPER_INDICES) {
        if (cells[ci] != null) upper[ci] = { value: cells[ci].value ?? 0 }
      }
      if (calculateUpperAbsolutePoints(upper) >= 63) {
        entry.bonusGames++
        global.bonusGames++
      }
    }
  }

  const out = {}
  for (const key of Object.keys(raw)) out[key] = finalizeEntry(raw[key])
  return out
}

// Typische Slider-Werte je Spieler (Median der Nicht-Strich-Werte) für die
// smarten Defaults im Eingabe-Dialog. { [playerKey]: { [cIdx]: value }, __global }.
export function computeTypicalValues(games) {
  const cs = computeCategoryStats(games)
  const out = {}
  for (const key of Object.keys(cs)) {
    const cats = cs[key].cats
    const r = {}
    for (const ci of SLIDER_INDICES) {
      const c = cats[ci]
      if (c && c.values.length) r[ci] = Math.round(c.median)
    }
    if (Object.keys(r).length) out[key] = r
  }
  return out
}
