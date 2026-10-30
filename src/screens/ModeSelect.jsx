import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import Globe from '../components/Globe'
import { Rocket } from '../components/SpaceArt'
import { takeGlobeHandoff } from '../lib/globeHandoff'

// --- Rakete im Orbit --------------------------------------------------------
// Die Bahn ist ein geneigter Kreis, von leicht oben gesehen: Tiefe z = cos(phi)
// (vorn > 0), Bildschirm-x = sin(phi), Bildschirm-y = cos(phi) * ORBIT_FLAT
// (vorn weiter unten, hinten weiter oben). Danach wird die Ellipse um
// ORBIT_TILT gedreht. Alle Maße sind Anteile der Globe-Größe, damit die Bahn
// auf jedem Telefon mitwächst und seitlich nie aus dem Bild läuft.
const ORBIT_R = 0.57 // Radius / Canvasbreite (= 0.68 * Scheibendurchmesser)
const ORBIT_FLAT = 0.38 // Bahn-Höhe / Radius (Blickwinkel von oben)
const ORBIT_TILT = (-20 * Math.PI) / 180 // Neigung der Bahn (rechts höher)
const ROCKET_K = 0.19 // Raketengröße / Canvasbreite
const ORBIT_SECONDS = 10
const ORBIT_SECONDS_REDUCED = 26
// Translate in % der eigenen Raketengröße => keine Messung im Frame nötig.
const ORBIT_PCT = (ORBIT_R / ROCKET_K) * 100
const COS_T = Math.cos(ORBIT_TILT)
const SIN_T = Math.sin(ORBIT_TILT)

// Geheimer Weg zur Strategie-Seite: dreimal auf die Erde, jeweils innerhalb
// von TAP_GAP_MS nach dem vorigen Tippen.
const TAP_GAP_MS = 700
const NAV_DELAY_MS = 250

// Die Übergabe-Länge vom Ladebildschirm gibt es nur einmal. React rendert
// unter StrictMode doppelt (und ruft Initialisierer doppelt auf): ohne
// Zwischenspeicher bekäme der zweite Aufruf null und die Erde spränge auf den
// Standardwert. Der Cache wird beim Verlassen des Menüs wieder geleert.
let handoffCache = { read: false, lon: null }
function readHandoff() {
  if (!handoffCache.read) handoffCache = { read: true, lon: takeGlobeHandoff() }
  return handoffCache.lon ?? 15
}

export default function ModeSelect({ onSelect }) {
  const { isLoggedIn, profile } = useAuth()

  const [startLon] = useState(readHandoff)
  const artRef = useRef(null)
  const rocketRef = useRef(null)
  const globeBoxRef = useRef(null)
  const ringRef = useRef(null)
  // onSelect immer in der neuesten Fassung, ohne den Timer neu zu bauen
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect
  const tap = useRef({ n: 0, at: 0, timer: 0, done: false })

  useEffect(() => {
    const t = tap.current
    t.done = false
    return () => {
      clearTimeout(t.timer)
      t.timer = 0
      handoffCache = { read: false, lon: null }
    }
  }, [])

  // Eine einzige rAF-Schleife: schreibt nur transform/z-index/opacity der
  // Rakete, kein React-State pro Frame.
  useEffect(() => {
    const el = rocketRef.current
    const art = artRef.current
    if (!el || !art) return undefined
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let reduced = !!mq?.matches
    el.classList.toggle('is-reduced', reduced)
    const onMq = () => {
      reduced = !!mq.matches
      el.classList.toggle('is-reduced', reduced)
    }
    mq?.addEventListener?.('change', onMq)

    let phi = -2.2 // Start hinten links, gleich geht es hinter die Erde
    let last = 0
    let raf = 0
    let onscreen = true
    let front = null

    const frame = (now) => {
      raf = 0
      const dt = last ? Math.min(now - last, 100) : 16.7
      last = now
      phi += (dt / 1000) * ((Math.PI * 2) / (reduced ? ORBIT_SECONDS_REDUCED : ORBIT_SECONDS))

      const sn = Math.sin(phi)
      const cs = Math.cos(phi) // Tiefe: 1 = ganz vorn, -1 = ganz hinten
      // Bahnpunkt (vor der Drehung) und Tangente (Ableitung nach phi)
      const x = sn
      const y = cs * ORBIT_FLAT
      const tx = cs
      const ty = -sn * ORBIT_FLAT
      const px = x * COS_T - y * SIN_T
      const py = x * SIN_T + y * COS_T
      const dx = tx * COS_T - ty * SIN_T
      const dy = tx * SIN_T + ty * COS_T
      // Die Raketenspitze zeigt im SVG nach oben => 0° = Blick nach oben.
      const angle = (Math.atan2(dx, -dy) * 180) / Math.PI
      const scale = 0.925 + 0.225 * cs // hinten 0.7, vorn 1.15

      el.style.transform = `translate3d(${(px * ORBIT_PCT).toFixed(1)}%, ${(py * ORBIT_PCT).toFixed(1)}%, 0) rotate(${angle.toFixed(1)}deg) scale(${scale.toFixed(3)})`
      el.style.opacity = (0.8 + 0.2 * cs).toFixed(2)
      // z-Ordnung nur bei Wechsel schreiben: hinter dem Globe (1 < 2) oder davor (3)
      const nowFront = cs > 0
      if (nowFront !== front) {
        front = nowFront
        el.style.zIndex = nowFront ? 3 : 1
      }
      raf = requestAnimationFrame(frame)
    }
    const start = () => {
      if (raf || document.hidden || !onscreen) return
      last = 0
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)
    // Aus dem Bild gescrollt => nichts animieren
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((es) => {
          onscreen = es[es.length - 1].isIntersecting
          if (onscreen) start()
          else stop()
        })
      : null
    io?.observe(art)
    start()

    return () => {
      stop()
      io?.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      mq?.removeEventListener?.('change', onMq)
    }
  }, [])

  // Dreimal tippen => Strategie. Das Feedback läuft über die Web Animations API
  // (keine Zustandsänderung, nichts wird nach dem Unmount noch gesetzt).
  const onEarthTap = () => {
    const t = tap.current
    if (t.done) return
    const now = performance.now()
    t.n = now - t.at > TAP_GAP_MS ? 1 : t.n + 1
    t.at = now
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const box = globeBoxRef.current
    // Tippen 1: kleiner Stups, 2: kräftiger, 3: Stups + heller Ring
    const bump = t.n === 1 ? 1.03 : t.n === 2 ? 1.07 : 1.1
    if (!reduce) {
      box?.animate?.(
        [
          { transform: 'scale(1)' },
          { transform: `scale(${bump}) rotate(${t.n === 2 ? 1.5 : 0}deg)`, offset: 0.4 },
          { transform: 'scale(1)' },
        ],
        { duration: t.n === 1 ? 220 : 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      )
    }
    if (t.n >= 3) {
      t.done = true
      navigator.vibrate?.(15)
      ringRef.current?.animate?.(
        [
          { opacity: 0.95, transform: 'scale(0.96)' },
          { opacity: 0, transform: 'scale(1.18)' },
        ],
        { duration: 320, easing: 'ease-out' },
      )
      // kurz warten, damit der Effekt sichtbar ist; Cleanup bricht den Timer ab
      t.timer = window.setTimeout(() => {
        t.timer = 0
        selectRef.current('strategy')
      }, NAV_DELAY_MS)
    }
  }

  // accent färbt Schein und Umriss-Zahl der Karte (siehe .mode-card in App.css).
  const modes = [
    {
      id: 'normal',
      label: 'NORMAL',
      icon: '🎲',
      desc: 'Klassisches Kniffel',
      accent: 'var(--accent-cyan)',
    },
    {
      id: 'lucky',
      label: 'LUCKY SCORE',
      icon: '🔮',
      desc: 'Tipp deinen Score — wer am nächsten dran ist gewinnt',
      accent: 'var(--accent-pink)',
    },
    {
      id: 'extrem',
      label: 'KNIFFEL EXTREM',
      icon: '🔥',
      desc: 'Drei Blöcke gleichzeitig — von oben, von unten, normal',
      accent: 'var(--accent-orange)',
    },
  ]

  // Online-Modus — braucht Anmeldung
  const online = {
    id: isLoggedIn ? 'online' : 'profile',
    label: 'ONLINE',
    icon: '🌐',
    desc: isLoggedIn
      ? 'Gegeneinander spielen, auch aus der Ferne — Tabelle live'
      : 'Zum Online-Spielen anmelden',
    accent: 'var(--accent-green)',
  }

  const cards = [...modes, online]

  return (
    <div className="home">
      <div className="home-inner">
        <div className="home-hero reveal" style={{ '--i': 0 }}>
          <div className="home-art" ref={artRef}>
            {/* Rakete liegt im selben Stapel wie die Erde: z-index 1 = hinter
                dem Globe-Canvas (von der Scheibe verdeckt), 3 = davor. Der
                Canvas ist außerhalb von Kugel und Schein durchsichtig. */}
            <div className="home-orbit" ref={rocketRef} aria-hidden="true">
              <span className="home-orbit-trail" />
              <Rocket />
            </div>
            <div className="home-globe" ref={globeBoxRef}>
              <Globe
                size="100%"
                speed={14}
                tilt={0}
                startLon={startLon}
                onTap={onEarthTap}
                label="Erde"
              />
            </div>
            <div className="home-ring" ref={ringRef} aria-hidden="true" />
          </div>
          <div className="home-title">KNIFFEL</div>
        </div>

        {cards.map((mode, i) => (
          <button
            key={mode.label}
            className="mode-card reveal"
            style={{ '--accent': mode.accent, '--i': i + 1 }}
            onClick={() => onSelect(mode.id)}
          >
            <span className="mode-num" aria-hidden="true">{i + 1}</span>
            <span className="mode-icon">{mode.icon}</span>
            <span className="mode-text">
              <span className="mode-label">{mode.label}</span>
              <span className="mode-desc">{mode.desc}</span>
            </span>
            <span className="mode-go" aria-hidden="true">→</span>
          </button>
        ))}

        <div className="home-links reveal" style={{ '--i': cards.length + 1 }}>
          <button className="home-link" onClick={() => onSelect('stats')}>
            📊 STATISTIKEN
          </button>
          <button className="home-link" onClick={() => onSelect('profile')}>
            {isLoggedIn ? '👤 KONTO' : '🔐 EINLOGGEN'}
          </button>
        </div>

        {isLoggedIn && (
          <div
            className="reveal"
            style={{
              '--i': cards.length + 2,
              color: 'var(--text-faint)',
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            Angemeldet als {profile?.display_name ?? '…'}
          </div>
        )}
      </div>
    </div>
  )
}
