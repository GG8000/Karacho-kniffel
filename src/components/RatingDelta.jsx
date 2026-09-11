import { useEffect, useRef, useState } from 'react'

// Zeigt in einer Ergebniskarte, was das Spiel am Rating geändert hat:
// "1042 → 1054" und daneben das Delta. Gefüttert von lib/useRatingPreview.js.
//
// Die Farben sind dieselben wie im Block (PlayerColumn.jsx): grün für einen
// Gewinn, rot für einen Verlust.
const GREEN = '#69ff47'
const RED = '#ff5252'
const GREY = 'rgba(255,255,255,0.45)'

const COUNT_MS = 900

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

// Zählt den Nachher-Wert hoch, damit der Zuwachs sichtbar PASSIERT statt nur
// dazustehen. delay staffelt die Karten nach Platzierung.
function useCountUp(from, to, delay) {
  const [value, setValue] = useState(from)
  const raf = useRef(0)

  useEffect(() => {
    if (prefersReducedMotion() || from === to) {
      setValue(to)
      return
    }
    setValue(from)
    let start = null
    const step = (ts) => {
      if (start === null) start = ts
      const p = Math.min((ts - start) / COUNT_MS, 1)
      // ease-out, damit die letzten Punkte langsam einrasten
      setValue(Math.round(from + (to - from) * (1 - (1 - p) ** 3)))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    const timer = setTimeout(() => {
      raf.current = requestAnimationFrame(step)
    }, delay)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf.current)
    }
  }, [from, to, delay])

  return value
}

export default function RatingDelta({ before, after, delta, index = 0 }) {
  const delay = index * 120
  const shown = useCountUp(before, after, delay)
  const color = delta > 0 ? GREEN : delta < 0 ? RED : GREY

  return (
    <div
      className="rating-delta"
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
        fontSize: 12,
        // Blendet mit derselben Verzögerung ein, mit der das Hochzählen
        // startet: sonst stünde für einen Moment sichtbar "1042 → 1042" da.
        animation: `ratingIn 320ms ease-out ${delay}ms both`,
      }}
    >
      <span style={{ color: 'rgba(255,255,255,0.45)' }}>
        Rating {before} → <span style={{ color }}>{shown}</span>
      </span>
      <span style={{ color, fontWeight: 'bold', fontSize: 13 }}>
        {delta > 0 ? `+${delta}` : delta < 0 ? String(delta) : '±0'}
      </span>
    </div>
  )
}
