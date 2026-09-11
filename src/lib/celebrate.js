// Kanal für die Kniffel-Feier. Gleiche Idee wie onSaveEvent in storage.js:
// ein Sender (ScoreInputModal, egal aus welchem Spielmodus) und ein einziger
// global gemounteter Empfänger (KniffelCelebration in main.jsx).

import { armCellEvent } from './pendingCell'

const listeners = new Set()

// Meldet sich für "es wurde ein Kniffel eingetragen" an. Gibt eine
// Abmelde-Funktion zurück.
export function onKniffel(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// detail: { kind: 'upper' | 'category', face: 1..6 | null }
export function celebrateKniffel(detail) {
  for (const cb of listeners) cb(detail)
}

// Wie celebrateKniffel, aber mit Bedenkzeit (siehe pendingCell.js). Nur für den
// oberen Teil: fünf Würfel sind dort der sechste Tap beim Durchklicken, und wer
// einen zu weit kommt, bekäme sonst die volle Feier für etwas, das er gleich
// wieder wegtippt.
//
// Das Sheet bleibt bewusst bei celebrateKniffel: die Kniffel-Zeile und das
// Häkchen bei 3er/4er/Chance sind bewusste Bestätigungen, keine
// Zwischenzustände.
export function armKniffel(key, detail) {
  armCellEvent(key, () => celebrateKniffel(detail))
}
