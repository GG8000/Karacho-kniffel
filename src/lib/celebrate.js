// Kanal für die Kniffel-Feier. Gleiche Idee wie onSaveEvent in storage.js:
// ein Sender (ScoreInputModal, egal aus welchem Spielmodus) und ein einziger
// global gemounteter Empfänger (KniffelCelebration in main.jsx).

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
