// Zählt, wie lange die App tatsächlich benutzt wird, und schickt den Stand
// zusammen mit einer gerätelokalen Zufallskennung an /api/session. Die Stadt
// kommt erst dort dazu (api/session.js) — der Client erfährt sie nie.
//
// Gezählt wird nur AKTIVE Zeit: Tab im Vordergrund und höchstens IDLE_MS seit
// der letzten Eingabe. Ohne diese Bremse würde "welche Stadt kniffelt am
// längsten" vor allem vergessene Tabs messen.
//
// Es gibt keinen Kontobezug: getrackt wird das Gerät, nicht der Spieler. Gäste
// und angemeldete Spieler zählen deshalb gleich.

const DEVICE_KEY = 'kniffel-device-id'
const OPTOUT_KEY = 'kniffel-geo-optout'

const IDLE_MS = 5 * 60 * 1000 // danach gilt die Sitzung als untätig
const TICK_MS = 15 * 1000 // Auflösung der Zeitrechnung
const FLUSH_MS = 60 * 1000 // wie oft der Stand rausgeht

const ENDPOINT = '/api/session'

// localStorage kann werfen (privater Modus in Safari) — das darf die App nie
// aufhalten, die Statistik ist Beiwerk.
function read(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // dann eben nur für diese Sitzung
  }
}

// Zufällige Gerätekennung, bewusst ohne jedes Fingerprinting-Merkmal: sie sagt
// "ein Gerät", nicht "diese Person".
export function deviceId() {
  let id = read(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    write(DEVICE_KEY, id)
  }
  return id
}

// Browserseitiges Signal, unabhängig von der Einstellung in der App. Getrennt
// abfragbar, damit das Profil erklären kann, warum der Schalter nichts bewirkt.
export function browserOptOut() {
  return (
    navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true
  )
}

export function isOptedOut() {
  return read(OPTOUT_KEY) === '1' || browserOptOut()
}

export function setOptedOut(value) {
  write(OPTOUT_KEY, value ? '1' : '0')
}

function post(payload, viaBeacon = false) {
  const json = JSON.stringify(payload)

  // Beim Schließen ist fetch() nicht mehr verlässlich, sendBeacon schon.
  if (viaBeacon && navigator.sendBeacon) {
    try {
      const blob = new Blob([json], { type: 'application/json' })
      if (navigator.sendBeacon(ENDPOINT, blob)) return
    } catch {
      // Fallback unten
    }
  }

  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: json,
    keepalive: true,
  }).catch(() => {})
  // Netzfehler sind hier egal, genau wie bei pushGame() in storage.js.
}

// Löscht alles, was zu diesem Gerät gespeichert ist (DSGVO Art. 17). Wirft bei
// Misserfolg, damit das Profil es dem Spieler sagen kann.
export async function forgetDevice() {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: deviceId(), forget: true }),
  })
  if (!res.ok) throw new Error(`Löschen fehlgeschlagen (${res.status})`)
}

// Startet die Zeitrechnung für diesen App-Start. Gibt die Stop-Funktion zurück.
export function startSessionTracking() {
  if (isOptedOut()) return () => {}

  const sessionId = crypto.randomUUID()
  const device = deviceId()

  let activeMs = 0
  let sentSeconds = -1
  let lastTick = Date.now()
  let lastInput = Date.now()

  function accrue() {
    const now = Date.now()
    const elapsed = now - lastTick
    lastTick = now
    if (
      document.visibilityState === 'visible' &&
      now - lastInput < IDLE_MS &&
      elapsed > 0 &&
      // Verschluckte Ticks (Standby, gedrosselte Timer am Handy) nicht als
      // Spielzeit verbuchen.
      elapsed < IDLE_MS
    ) {
      activeMs += elapsed
    }
  }

  function flush(viaBeacon = false) {
    accrue()
    const seconds = Math.round(activeMs / 1000)
    // Nichts Neues -> nicht senden. Spart den Großteil der Aufrufe.
    if (seconds <= 0 || seconds === sentSeconds) return
    sentSeconds = seconds
    // Immer der kumulative Stand, nie ein Delta: damit ist jeder Flush
    // idempotent und ein verspäteter Beacon kann nichts doppelt zählen
    // (greatest() in record_session).
    post({ sessionId, deviceId: device, activeSeconds: seconds }, viaBeacon)
  }

  function onInput() {
    lastInput = Date.now()
  }

  function onVisibility() {
    accrue()
    if (document.visibilityState === 'hidden') flush(true)
    else lastInput = Date.now() // Zurückkommen zählt als Interaktion
  }

  function onPageHide() {
    flush(true)
  }

  const ticker = setInterval(accrue, TICK_MS)
  const flusher = setInterval(flush, FLUSH_MS)

  const passive = { passive: true }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('pointerdown', onInput, passive)
  window.addEventListener('keydown', onInput, passive)

  return () => {
    clearInterval(ticker)
    clearInterval(flusher)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('pointerdown', onInput, passive)
    window.removeEventListener('keydown', onInput, passive)
    flush(true)
  }
}
