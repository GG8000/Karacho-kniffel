import { useEffect, useRef, useState } from 'react'
import { onSaveEvent } from '../storage'
import { onToast } from '../lib/toast'
import { useAuth } from '../auth/AuthContext'

// Zeigt kurz eine Meldung an und blendet sie wieder aus. Zwei Quellen: das
// Speichern eines Spiels (onSaveEvent) und der freie Kanal lib/toast.js, über den
// die Spielmodi z.B. "Geändert · Rückgängig" schicken. Wird einmal in main.jsx
// gemountet, damit er die Navigation zwischen den Screens überlebt.
export default function Toaster() {
  const { isLoggedIn } = useAuth()
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  // Ein Timer für beide Quellen: die zweite Meldung löst die erste ab, statt
  // dass zwei Toasts übereinander liegen.
  function show(next, ms) {
    clearTimeout(timer.current)
    setToast(next)
    timer.current = setTimeout(() => setToast(null), ms)
  }

  useEffect(() => {
    const off = onSaveEvent(() => {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true
      let text
      if (!isLoggedIn) text = '✓ Lokal gespeichert'
      else if (online) text = '✓ Gespeichert – Upload läuft im Hintergrund'
      else text = '📴 Offline gespeichert – wird bei Internet hochgeladen'
      show({ text }, 2500)
    })
    return off
  }, [isLoggedIn])

  useEffect(() => {
    // Mit Button länger stehen lassen — 2,5 s reichen nicht, um ihn zu treffen.
    const off = onToast((detail) =>
      show(detail, detail.ms ?? (detail.actionLabel ? 5000 : 2200)),
    )
    return off
  }, [])

  // Nur beim Unmount — nicht bei jedem isLoggedIn-Wechsel, sonst bliebe ein
  // gerade sichtbarer Toast ohne Timer stehen.
  useEffect(() => () => clearTimeout(timer.current), [])

  if (!toast) return null
  return (
    <div className="toast">
      <span>{toast.text}</span>
      {toast.actionLabel && (
        <button
          className="toast-action"
          onClick={() => {
            clearTimeout(timer.current)
            setToast(null)
            toast.onAction?.()
          }}
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
  )
}
