import { useCallback, useRef, useState } from 'react'
import { cancelAllCellEvents } from './pendingCell'

// Verlauf für den Punktestand: jede Eintragung legt den vorherigen Stand auf
// einen Stapel, "Rückgängig" holt ihn schrittweise zurück. Gilt nur für die
// Sitzung (nichts wird gespeichert) und nur für die Scores — Spieler bleiben
// wie sie sind.
//
// Ein Snapshot ist der ganze scores-Baum: klein (13 Zellen je Spieler) und
// unveränderlich, weil überall mit Kopien gearbeitet wird.
//
// setScores(updater, mode):
//   'record'  (Standard) Änderung merken, rückgängig machbar
//   'silent'  ändern, ohne einen Schritt anzulegen
//   'all'     denselben Updater auch auf alle gemerkten Stände anwenden —
//             für Spieler hinzufügen/entfernen, damit alte Stände zu den
//             aktuellen Spielern passen
//   'reset'   ersetzen und den Verlauf leeren (Restart, Revanche)
const LIMIT = 200

export function useScoresHistory(initial = {}) {
  const [scores, setRaw] = useState(initial)
  const current = useRef(scores)
  const stack = useRef([])
  const [depth, setDepth] = useState(0)

  const setScores = useCallback((update, mode = 'record') => {
    const apply = (s) => (typeof update === 'function' ? update(s) : update)
    const next = apply(current.current)
    if (mode === 'reset') {
      stack.current = []
    } else if (mode === 'all') {
      stack.current = stack.current.map(apply)
    } else if (mode === 'record') {
      if (next === current.current) return
      stack.current.push(current.current)
      if (stack.current.length > LIMIT) stack.current.shift()
    }
    current.current = next
    setRaw(next)
    setDepth(stack.current.length)
  }, [])

  const undo = useCallback(() => {
    if (!stack.current.length) return
    // Noch ausstehende Feiern/Streich-Animationen gehören zu einem Stand, den
    // es nicht mehr gibt.
    cancelAllCellEvents()
    current.current = stack.current.pop()
    setRaw(current.current)
    setDepth(stack.current.length)
  }, [])

  return { scores, setScores, undo, canUndo: depth > 0 }
}
