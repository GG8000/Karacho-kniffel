import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Wie oft im Vordergrund beim Server nachgefragt wird, ob ein neuer Build da ist.
const CHECK_INTERVAL = 60 * 1000

// Falls das controllerchange-Event ausbleibt (kommt auf iOS vor), laden wir
// nach dieser Zeit selbst neu.
const RELOAD_FALLBACK = 3000

// Zeigt ein Modal, sobald ein neuer Build bereitsteht. Der Service Worker
// wartet dabei im Hintergrund — erst der Knopfdruck übernimmt ihn und lädt neu,
// damit ein laufender Kniffel-Block nicht unter den Fingern wegbricht.
export default function UpdatePrompt() {
  const [registration, setRegistration] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW: (_swUrl, r) => setRegistration(r ?? null)
  })

  useEffect(() => {
    if (!registration) return

    const check = () => {
      // Ohne Netz oder im Hintergrund bringt die Abfrage nichts.
      if (document.visibilityState !== 'visible') return
      if (!navigator.onLine) return
      registration.update().catch(() => {})
    }

    // iOS behält die Homescreen-App im Speicher: Beim Zurückwechseln feuert
    // kein load-Event mehr. Ohne diesen Timer und den visibilitychange-Listener
    // würde nach dem allerersten Start nie wieder auf ein Update geprüft.
    const timer = setInterval(check, CHECK_INTERVAL)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
    check()

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', check)
    }
  }, [registration])

  async function applyUpdate() {
    setBusy(true)
    setTimeout(() => window.location.reload(), RELOAD_FALLBACK)
    try {
      await updateServiceWorker(true)
    } catch {
      window.location.reload()
    }
  }

  if (!needRefresh) return null

  // Nach "Später" bleibt nur eine kleine Pille stehen, über die man das Modal
  // jederzeit wieder aufmachen kann.
  if (dismissed) {
    return (
      <button className="update-pill" onClick={() => setDismissed(false)}>
        ⬆︎ Update bereit
      </button>
    )
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <div className="dialog-title">🎲 Neue Version verfügbar</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
          Es gibt ein Update für den Kniffel-Block. Gespeicherte Spiele und
          Statistiken bleiben erhalten. Ein laufendes Spiel solltest du vorher
          zu Ende zählen.
        </div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
          Installiert: {__APP_VERSION__}
        </div>
        <div className="dialog-actions">
          <button
            className="btn-outline"
            onClick={() => setDismissed(true)}
            disabled={busy}
          >
            Später
          </button>
          <button className="btn-primary" onClick={applyUpdate} disabled={busy}>
            {busy ? 'Lädt neu…' : 'Jetzt aktualisieren'}
          </button>
        </div>
      </div>
    </div>
  )
}
