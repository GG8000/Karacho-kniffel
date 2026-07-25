import { useEffect, useState } from 'react'
import { onSaveEvent } from '../storage'
import { useAuth } from '../auth/AuthContext'

// Zeigt nach jedem lokal gespeicherten Spiel kurz einen Toast an und blendet ihn
// wieder aus. Wird einmal in App.jsx gemountet, damit er die Navigation zurück
// ins Menü überlebt.
export default function Toaster() {
  const { isLoggedIn } = useAuth()
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let timer
    const unsubscribe = onSaveEvent(() => {
      // Meldung passend zum Kontext zusammenstellen.
      const online =
        typeof navigator !== 'undefined' ? navigator.onLine : true
      if (!isLoggedIn) {
        setMessage('✓ Lokal gespeichert')
      } else if (online) {
        setMessage('✓ Gespeichert – Upload läuft im Hintergrund')
      } else {
        setMessage('📴 Offline gespeichert – wird bei Internet hochgeladen')
      }
      clearTimeout(timer)
      timer = setTimeout(() => setMessage(null), 2500)
    })
    return () => {
      unsubscribe()
      clearTimeout(timer)
    }
  }, [isLoggedIn])

  if (!message) return null
  return <div className="toast">{message}</div>
}
