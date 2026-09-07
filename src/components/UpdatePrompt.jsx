import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Wie oft im Vordergrund beim Server nachgefragt wird, ob ein neuer Build da ist.
const CHECK_INTERVAL = 60 * 1000

// Notnagel, falls controllerchange ganz ausbleibt. Bewusst großzügig: der neue
// Worker muss erst aktivieren und cleanupOutdatedCaches() durchlaufen. Wird zu
// früh neu geladen, liefert noch der ALTE Worker die Seite aus — die App bleibt
// auf dem alten Stand, der neue Worker hängt weiter im Wartestand und meldet
// sich beim nächsten Start wieder. Genau das war der Fehler mit 3 Sekunden.
const RELOAD_FALLBACK = 12000

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

    let reloaded = false
    const reload = () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    }

    // Verlässliches Signal ist die Übernahme durch den neuen Worker, nicht ein
    // fester Timer: updateServiceWorker() schickt nur SKIP_WAITING und kehrt
    // sofort zurück, die Aktivierung läuft danach noch. clientsClaim() ist in
    // vite.config.js gesetzt, controllerchange kommt also zuverlässig, sobald
    // der neue Worker wirklich das Sagen hat.
    navigator.serviceWorker?.addEventListener('controllerchange', reload, {
      once: true,
    })
    const fallback = setTimeout(reload, RELOAD_FALLBACK)

    try {
      await updateServiceWorker(true)
    } catch {
      clearTimeout(fallback)
      reload()
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
