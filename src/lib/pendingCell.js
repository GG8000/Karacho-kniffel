// Ereignisse, die an einer Zelle hängen und erst gelten sollen, wenn sie einen
// Moment lang Bestand hatten.
//
// Die festen Felder (FH, KL STR, GR STR) werden durchgeklickt (leer→
// eingetragen→gestrichen, siehe nextCellState), und ein langer Druck streicht
// ein oberes Feld direkt. "Gestrichen" ist dort ein Zustand, den man beim
// Weitertippen nur durchläuft. Eine Animation, die sofort losgeht, betrauert
// deshalb regelmäßig etwas, das gleich wieder weg ist.
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

// Nimmt ALLE angemeldeten Ereignisse zurück — beim schrittweisen Rückgängig
// weiß der Aufrufer nicht, welche Zellen der Schritt berührt.
export function cancelAllCellEvents() {
  for (const timer of pending.values()) clearTimeout(timer)
  pending.clear()
}
