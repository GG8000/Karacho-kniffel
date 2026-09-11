// Kanal für die Streich-Animation. Gleiche Idee wie celebrate.js und toast.js:
// beliebig viele Sender, ein einziger global gemounteter Empfänger
// (StrikeAnimation in main.jsx).

import { UPPER_INDICES } from '../logic/kniffel'
import { armCellEvent, cancelCellEvent, SETTLE_MS } from './pendingCell'

const listeners = new Set()

// Meldet sich für "es wurde etwas gestrichen" an. Gibt eine Abmelde-Funktion
// zurück.
export function onStrike(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// detail: { category, cIdx, playerName? }
export function announceStrike(detail) {
  for (const cb of listeners) cb(detail)
}

// Kündigt eine Streichung an, die der nächste Tap auf dieselbe Zelle noch
// zurücknehmen kann (siehe pendingCell.js).
//
// Im oberen Teil ist die Streichung zugleich der ERSTE Tap beim Durchklicken,
// dort wird gewartet. Unten ist sie eine bewusste Eingabe und darf sofort
// knallen — über denselben Timer, damit ein direkt folgender Tap sie auch dann
// noch erwischt.
export function armStrike(key, detail) {
  const delay = UPPER_INDICES.includes(detail.cIdx) ? SETTLE_MS : 0
  armCellEvent(key, () => announceStrike(detail), delay)
}

export function cancelStrike(key) {
  cancelCellEvent(key)
}
