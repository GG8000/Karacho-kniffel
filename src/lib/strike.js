// Kanal für die Streich-Animation. Gleiche Idee wie celebrate.js und toast.js:
// beliebig viele Sender, ein einziger global gemounteter Empfänger
// (StrikeAnimation in main.jsx).

import { UPPER_INDICES } from '../logic/kniffel'

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

// Im oberen Teil ist die Streichung zugleich der ERSTE Tap beim Durchklicken
// 0→1→2→3→4→5 (siehe nextCellState). Dort wird deshalb gewartet, ob die Zelle
// wirklich auf 0 Würfeln stehen bleibt; unten ist die Streichung eine bewusste
// Eingabe und darf sofort knallen.
const SETTLE_MS = 700

const pending = new Map()

// Kündigt eine Streichung an, die der nächste Tap auf dieselbe Zelle noch
// zurücknehmen kann. key ist der Zellschlüssel ("<pIdx>:<cIdx>", in Extrem mit
// Block dazwischen) — derselbe, den useArmedCell benutzt.
export function armStrike(key, detail) {
  cancelStrike(key)
  const delay = UPPER_INDICES.includes(detail.cIdx) ? SETTLE_MS : 0
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key)
      announceStrike(detail)
    }, delay),
  )
}

// Nimmt eine angekündigte Streichung zurück: weitergeklickt, geleert oder per
// "Rückgängig" zurückgeholt.
export function cancelStrike(key) {
  const timer = pending.get(key)
  if (timer === undefined) return
  clearTimeout(timer)
  pending.delete(key)
}
