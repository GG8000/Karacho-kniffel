// Welche Augenzahl wird am häufigsten als Kniffel gewürfelt?
//
// Datenquelle sind dieselben Spiele wie in stats.js (aus getHistory()), es
// zählen nur Normal-Spiele mit cells. Zwei Quellen fliessen zusammen:
//
//  1. Kniffel-Zeile (Index 12): die im Modal angetippte Augenzahl in cells[12].face.
//     Ältere Einträge haben keine — sie zählen als "ohne Angabe".
//  2. Oberer Teil: fünf gleiche Würfel sind ebenfalls ein Kniffel. Die Augenzahl
//     steckt dort schon im Kategorie-Index und lässt sich über decodeCell()
//     RÜCKWIRKEND aus allen bisherigen Spielen rekonstruieren.

import { keyOf } from './stats'
import { decodeCell, UPPER_INDICES } from './categoryStats'

const KNIFFEL_INDEX = 12

function emptyEntry() {
  return {
    total: 0,
    faces: [0, 0, 0, 0, 0, 0], // Index 0 = Augenzahl 1
    fromRow: 0,
    fromUpper: 0,
    unknown: 0, // Kniffel-Zeile ohne getippte Augenzahl
  }
}

function addFace(entry, face) {
  entry.total++
  entry.faces[face - 1]++
}

// Trägt alle Kniffel EINES Spielers aus EINEM Spiel ein.
function accumulate(entry, cells) {
  // 1. Kniffel-Zeile. Bewusst über den Wert erkannt und nicht über isKniffel:
  // das Flag wurde in dieser Zeile erst später korrekt gesetzt, ältere
  // Einträge tragen dort faelschlich false.
  const row = cells[KNIFFEL_INDEX]
  if (row != null && (row.value ?? 0) > 0) {
    const face = row.face
    if (Number.isInteger(face) && face >= 1 && face <= 6) {
      addFace(entry, face)
      entry.fromRow++
    } else {
      entry.total++
      entry.unknown++
    }
  }

  // 2. Oberer Teil: fünf gleiche Würfel.
  for (const ci of UPPER_INDICES) {
    const cell = cells[ci]
    if (cell == null) continue
    if (decodeCell(ci, cell.value ?? 0).metric === 5) {
      addFace(entry, ci + 1)
      entry.fromUpper++
    }
  }
}

// Haupt-Aggregat. Gibt { [playerKey]: entry, __global: entry } zurück.
export function computeKniffelFaces(games) {
  const out = { __global: emptyEntry() }

  for (const game of games ?? []) {
    if (game.mode !== 'normal') continue
    for (const p of game.participants ?? []) {
      const cells = p.cells
      if (!cells || typeof cells !== 'object') continue

      accumulate((out[keyOf(p)] ??= emptyEntry()), cells)
      accumulate(out.__global, cells)
    }
  }
  return out
}

// Die häufigste Augenzahl. null bei keinen Daten, bei Gleichstand die kleinere.
export function topFace(entry) {
  if (!entry || !entry.faces.some((n) => n > 0)) return null
  let best = 0
  for (let i = 1; i < 6; i++) if (entry.faces[i] > entry.faces[best]) best = i
  return { face: best + 1, count: entry.faces[best] }
}
