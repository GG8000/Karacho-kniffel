import { calculateUpperBalance, calculateTotal } from './calculator'

// Kategorien des normalen Kniffel-Blocks (Index 6 = SUMME, 14 = TOTAL sind
// abgeleitet, alle anderen werden eingetragen).
export const CATEGORIES = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  'SUMME',
  '3er',
  '4er',
  'FH',
  'KL STR',
  'GR STR',
  'KNFFL',
  'CHNC',
  'TOTAL',
]

export const PLAYABLE_INDICES = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13]

// Die vier Zellarten. Der obere Teil und die festen Punktzahlen werden direkt
// in der Zelle durchgeklickt, die anderen beiden öffnen ein Sheet.
export const UPPER_INDICES = [0, 1, 2, 3, 4, 5]
export const WHEEL_INDICES = [7, 8, 13] // 3er, 4er, CHNC — Auswahlrad
export const FIXED_INDICES = [9, 10, 11] // FH, KL STR, GR STR
export const KNIFFEL_INDEX = 12
export const SUM_INDICES = [6, 14] // abgeleitet, nie antippbar

export const FIXED_POINTS = { 9: 25, 10: 30, 11: 40, 12: 50 }

// Wertebereich des Auswahlrads: gewertet wird die Summe aller fünf Würfel,
// also mindestens 5 (fünf Einsen) und höchstens 30 (fünf Sechsen).
export const WHEEL_MIN = 5
export const WHEEL_MAX = 30

// Der obere Teil speichert eine BALANCE relativ zu drei Würfeln, nicht die
// absoluten Punkte: value = (anzahl - 3) * augenzahl. calculator.js rechnet mit
// + 3*augenzahl zurück, categoryStats.decodeCell rekonstruiert die Anzahl.
// Beides bricht still, wenn hier andere Zahlen entstehen.
export const upperValue = (cIdx, count) => (count - 3) * (cIdx + 1)
export const upperCount = (cIdx, value) => Math.round(value / (cIdx + 1) + 3)

// Ein Kniffel ist bei 3er/4er/Chance nur möglich, wenn die Summe fünf gleiche
// Würfel sein KANN — also ein Vielfaches von 5 im Radbereich.
export function kniffelFaceFor(value) {
  if (value % 5 !== 0) return null
  const face = value / 5
  return face >= 1 && face <= 6 ? face : null
}

// Was ein Tap auf eine Zelle auslöst:
//   { kind: 'set', entry }  neuer Zellinhalt
//   { kind: 'clear' }       Zelle leeren
//   { kind: 'sheet' }       Rad bzw. Würfelauswahl öffnen
//   null                    nicht antippbar (SUMME / TOTAL)
//
// Oben zählt jeder Tap eine Würfelanzahl weiter: 1. Tap = 0 Würfel
// (gestrichen), 6. Tap = 5 Würfel (Kniffel), 7. Tap = wieder leer.
export function nextCellState(cIdx, entry) {
  if (SUM_INDICES.includes(cIdx)) return null

  // Der Zeitpunkt gehört zum ERSTEN Tap: daraus leitet buildGamePayload den
  // turn 1..13 ab, den orderStats auswertet. Würde jeder Tap ihn neu setzen,
  // rutschte jede durchgeklickte Zelle ans Ende der Zugreihenfolge.
  const timestamp = entry?.timestamp ?? Date.now()

  if (UPPER_INDICES.includes(cIdx)) {
    const count = entry ? upperCount(cIdx, entry.value) : -1
    const next = count + 1
    if (next > 5) return { kind: 'clear' }
    return {
      kind: 'set',
      entry: {
        value: upperValue(cIdx, next),
        timestamp,
        isKniffel: next === 5,
        face: next === 5 ? cIdx + 1 : null,
      },
    }
  }

  if (FIXED_INDICES.includes(cIdx)) {
    const points = FIXED_POINTS[cIdx]
    if (!entry) {
      return {
        kind: 'set',
        entry: { value: points, timestamp, isKniffel: false, face: null },
      }
    }
    // Eingetragen -> gestrichen -> leer.
    if (entry.value === points) {
      return {
        kind: 'set',
        entry: { value: 0, timestamp, isKniffel: false, face: null },
      }
    }
    return { kind: 'clear' }
  }

  return { kind: 'sheet' }
}

// Beschriftung einer SPIELBAREN Zelle. SUMME und TOTAL bleiben außen vor —
// die beiden Spalten-Komponenten zeigen dort Unterschiedliches an.
//
// Leer bleibt leer, damit "-" eindeutig "drei mal die Zahl" heißt (Balance 0);
// im unteren Teil steht "x" für gestrichen.
export function formatCell(cIdx, entry) {
  if (!entry) return ''
  const { value } = entry
  if (UPPER_INDICES.includes(cIdx)) {
    if (value === 0) return '-'
    return value > 0 ? `+${value}` : String(value)
  }
  return value === 0 ? 'x' : String(value)
}

// Ergänzt die abgeleiteten Summenfelder (wie refreshTotals im lokalen Modus),
// damit PlayerColumn SUMME/TOTAL rendern kann.
export function withTotals(playerScores) {
  return {
    ...playerScores,
    6: { value: calculateUpperBalance(playerScores) },
    14: { value: calculateTotal(playerScores) },
  }
}

export function isBoardComplete(playerIds, scoresByPlayer) {
  return (
    playerIds.length > 0 &&
    playerIds.every((pid) =>
      PLAYABLE_INDICES.every((ci) => scoresByPlayer[pid]?.[ci] !== undefined),
    )
  )
}
