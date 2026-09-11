// Kanal für die Anleitung. Gleiche Idee wie toast.js, celebrate.js und
// strike.js: beliebig viele Sender (der "?"-Knopf jeder Spielansicht, der
// erste App-Start), ein einziger global gemounteter Empfänger (Guide in
// main.jsx).
//
// Der Umweg über einen Kanal spart es, den Offen-Zustand durch vier Screens zu
// fädeln, die sonst nichts miteinander zu tun haben.

const listeners = new Set()

// Meldet sich für "die Anleitung soll aufgehen" an. Gibt eine Abmelde-Funktion
// zurück.
export function onGuide(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function openGuide() {
  for (const cb of listeners) cb()
}
