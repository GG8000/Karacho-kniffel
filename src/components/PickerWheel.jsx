import { useEffect, useLayoutEffect, useRef } from 'react'

// Auswahlrad wie der iOS-Zeitpicker. Bewusst über CSS scroll-snap statt über
// eigene Pointer-Events: die Momentum-Physik kommt dann vom Browser, funktioniert
// am Trackpad genauso wie am Finger und fühlt sich auf iOS nativ an.

const ITEM = 44 // Zeilenhöhe in px
const VISIBLE = 5 // sichtbare Zeilen (ungerade, damit eine mittig steht)
const PAD = ((VISIBLE - 1) / 2) * ITEM // Platz, damit auch der erste und der
// letzte Wert in die Mitte scrollen können
const SETTLE = 120 // ms Ruhe, bevor der Wert übernommen wird

export default function PickerWheel({ min, max, value, onChange }) {
  const listRef = useRef(null)
  const timerRef = useRef(null)
  const rafRef = useRef(null)
  // Sperrt onChange, während wir selbst scrollen (Startposition, Tastatur).
  const silentRef = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value

  const count = max - min + 1
  const items = Array.from({ length: count }, (_, i) => min + i)

  const scrollToValue = (v, smooth) => {
    const el = listRef.current
    if (!el) return
    silentRef.current = true
    el.scrollTo({ top: (v - min) * ITEM, behavior: smooth ? 'smooth' : 'auto' })
    // Falls gar kein scroll-Event mehr kommt (Position stimmt schon), darf die
    // Sperre nicht stehen bleiben.
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(settle, SETTLE)
  }

  // Läuft, sobald der Scroll zur Ruhe gekommen ist. Ein eigener Programm-Scroll
  // meldet keinen Wert zurück, sondern hebt nur die Sperre auf — und zwar erst
  // hier, damit auch ein langes smooth-Scrollen sicher abgedeckt ist.
  function settle() {
    const el = listRef.current
    if (!el) return
    if (silentRef.current) {
      silentRef.current = false
      return
    }
    const next = Math.min(max, Math.max(min, min + Math.round(el.scrollTop / ITEM)))
    if (next !== valueRef.current) onChange(next)
  }

  // Startposition setzen, ohne ein Schein-onChange auszulösen.
  useLayoutEffect(() => {
    scrollToValue(valueRef.current, false)
    paint()
    return () => {
      clearTimeout(timerRef.current)
      cancelAnimationFrame(rafRef.current)
    }
    // Nur beim Öffnen — späteres Nachführen würde das Wischen unterbrechen.
  }, [])

  // Verlauf zur Mitte hin. Läuft imperativ im rAF, damit das Scrollen keine
  // React-Renders auslöst.
  function paint() {
    const el = listRef.current
    if (!el) return
    const center = el.scrollTop
    for (let i = 0; i < el.children.length; i++) {
      const node = el.children[i]
      if (!node.dataset.item) continue
      // Skaliert wird der innere span, nicht die Snap-Zeile selbst — ein
      // transform auf dem Snap-Element verschiebt auf iOS die Snap-Punkte.
      const inner = node.firstChild
      if (!inner) continue
      const distance = Math.abs((i - 1) * ITEM - center) / ITEM
      const fade = Math.max(0, 1 - distance * 0.34)
      inner.style.opacity = String(0.25 + fade * 0.75)
      inner.style.transform = `scale(${0.78 + fade * 0.22})`
    }
  }

  function handleScroll() {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(paint)
    // scrollend ist auf iOS-Safari nicht brauchbar — deshalb warten wir auf
    // eine kurze Pause im Scroll-Strom. Jedes Event schiebt sie nach hinten,
    // Momentum und smooth-Scrollen laufen also sauber aus.
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(settle, SETTLE)
  }

  function handleKeyDown(e) {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = Math.min(max, Math.max(min, valueRef.current + step))
    if (next === valueRef.current) return
    onChange(next)
    scrollToValue(next, true)
  }

  // Wenn der Wert von außen kommt (Zahlenfeld am Laptop, Pfeiltasten), das Rad
  // nachziehen — aber nur, wenn es gerade nicht ohnehin dort steht.
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const shown = min + Math.round(el.scrollTop / ITEM)
    if (shown !== value) scrollToValue(value, true)
  }, [value, min])

  return (
    <div
      className="wheel"
      style={{ height: VISIBLE * ITEM }}
      tabIndex={0}
      role="spinbutton"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onKeyDown={handleKeyDown}
    >
      {/* Die Bande markiert die Auswahl. Liegt über der Liste, darf sie aber
          nicht abfangen. */}
      <div className="wheel-band" style={{ height: ITEM, top: PAD }} />

      <div ref={listRef} className="wheel-list" onScroll={handleScroll}>
        <div style={{ height: PAD, flexShrink: 0 }} />
        {items.map((n) => (
          <div
            key={n}
            data-item="1"
            className="wheel-item"
            style={{ height: ITEM }}
            onClick={() => {
              onChange(n)
              scrollToValue(n, true)
            }}
          >
            <span className="wheel-value">{n}</span>
          </div>
        ))}
        <div style={{ height: PAD, flexShrink: 0 }} />
      </div>
    </div>
  )
}
