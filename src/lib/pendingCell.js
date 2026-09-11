// Ereignisse, die an einer Zelle hängen und erst gelten sollen, wenn sie einen
// Moment lang Bestand hatten.
//
// Der obere Teil wird durchgeklickt (0→1→2→3→4→5 Würfel, siehe nextCellState).
// Der erste Tap heißt "gestrichen", der sechste "Kniffel" — beides Zustände,
// die man beim Weitertippen nur durchläuft. Eine Animation, die sofort losgeht,
// feiert oder betrauert deshalb regelmäßig etwas, das gleich wieder weg ist.
//
// Ein einziger Timer JE ZELLE, für alle Ereignisarten zusammen: eine Zelle kann
// nicht gleichzeitig gestrichen und Kniffel sein, das Anmelden des einen darf
// das andere also zu Recht verwerfen.

export const SETTLE_MS = 700

const pending = new Map()

// Meldet ein Ereignis für eine Zelle an. key ist der Zellschlüssel
// ("<pIdx>:<cIdx>", in Kniffel Extrem mit dem Block dazwischen) — derselbe, den
// useArmedCell benutzt. Ein zweiter Aufruf für dieselbe Zelle ersetzt den
// ersten.
export function armCellEvent(key, fire, delay = SETTLE_MS) {
  cancelCellEvent(key)
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key)
      fire()
    }, delay),
  )
}

// Nimmt ein angemeldetes Ereignis zurück: weitergeklickt, geleert oder per
// "Rückgängig" zurückgeholt.
export function cancelCellEvent(key) {
  const timer = pending.get(key)
  if (timer === undefined) return
  clearTimeout(timer)
  pending.delete(key)
}
