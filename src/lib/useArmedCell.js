import { useCallback, useEffect, useRef, useState } from 'react'

// Schutz gegen Fehltipps: Ein Tap auf eine SCHON GEFÜLLTE Zelle ändert nichts
// mehr, er schaltet sie nur "scharf". Erst der zweite Tap editiert.
//
// Der Timer ist der Kern der Sache. Nach dem ersten Tap auf eine leere Zelle ist
// diese gefüllt UND scharf — die Taps 2 bis 6 des oberen Teils (0→1→2→3→4→5
// Würfel) laufen deshalb ohne Unterbrechung durch. Erst wer ~3 s nichts tut oder
// woanders hintippt, muss wieder zweimal tippen.
//
// Die Zellen mit Sheet (3er/4er/CHNC, KNFFL) brauchen das nicht: Das Sheet ändert
// von sich aus noch nichts.
const TIMEOUT_MS = 3000

export function useArmedCell(timeoutMs = TIMEOUT_MS) {
  const [armed, setArmed] = useState(null)
  const timer = useRef(null)

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  const disarm = useCallback(() => {
    clearTimer()
    setArmed(null)
  }, [clearTimer])

  const arm = useCallback(
    (key) => {
      clearTimer()
      setArmed(key)
      timer.current = setTimeout(() => setArmed(null), timeoutMs)
    },
    [clearTimer, timeoutMs],
  )

  // true  -> Änderung ausführen
  // false -> nur scharf geschaltet, Aufrufer bricht ab
  const requestEdit = useCallback(
    (key, isFilled) => {
      const wasArmed = armed === key
      arm(key)
      return !isFilled || wasArmed
    },
    [armed, arm],
  )

  return { armed, requestEdit, disarm }
}
