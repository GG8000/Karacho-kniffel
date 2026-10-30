// Ladebildschirm: Die Würfel-Rakete (SVG-Rakete mit Würfelauge im Bullauge)
// startet VERDECKT hinter der (echten, drehenden) Erde, taucht am oberen Rand
// der Kugel auf, fliegt senkrecht (Nase oben, ohne Drehen/Pendeln) auf den
// Spieler zu, rauscht an der Kamera vorbei
// (Bildschirm-Shake + Blitz), danach erscheint der Titel.
//
// Alles pro Frame läuft über Refs und direkt gesetzte transform/opacity-Werte
// (kein React-State, kein Layout). Die Maße werden nur bei Mount/Resize
// gemessen. Der Ton (lib/launchSound.js) bekommt dieselbe Zeitleiste.
//
// Glätte: Position, Größe, Flamme und Unschärfe sind reine Funktionen EINES
// Fortschritts p (0 = hinter der Erde, 1 = Vorbeiflug), siehe lib/launchFlight.js.
// Keine Phasen mit Geschwindigkeitssprung.

import { useEffect, useRef, useState } from 'react'
import Globe, { GLOBE_DISC_RATIO, preloadGlobe } from './Globe'
import { createLaunchSound, isSoundMuted, setSoundMuted } from '../lib/launchSound'
import { setGlobeHandoff } from '../lib/globeHandoff'
import { makeFlight, flameY, NOZZLE } from '../lib/launchFlight'

// So früh wie möglich anstoßen (läuft schon beim Import in App.jsx), damit die
// Landmassen-Textur beim ersten Frame fertig ist.
preloadGlobe()

// ---- Zeitleiste (ms ab erstem Frame) ---------------------------------------
// pass: Rakete rauscht an der Kamera vorbei (p = 1, Shake/Blitz, Ton-passAt)
// reveal: Titel erscheint (Ton-Akkord liegt bei pass + 200 ms)  |  end: onDone
// Zwischen reveal und end bleibt ein ruhiger Moment, in dem der Titel steht.
const FULL = { pass: 3300, reveal: 3500, end: 5000, sMax: 14, post: 220, ember: 1 }
// Bewegung reduziert: kürzer, kleiner, ohne Shake/Blitz/Vibration.
const CALM = { pass: 1700, reveal: 1900, end: 3200, sMax: 4.5, post: 500, ember: 0.4 }

const RES = 4 // Rakete wird 4x größer gerastert und runterskaliert -> bleibt beim Heranfliegen scharf
const S_MIN = 0.16 // Anfangsgröße (Vielfaches der Raketenbreite-Einheit B)
const EARTH_SPEED = 24 // Grad pro Sekunde: sichtbar, aber ruhig
const VISIBLE = 0.62 // so viel der Kugelscheibe (von oben) ist sichtbar
const SHAKE_MS = 560
const MAX_EMBERS = 22

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a, b, k) => a + (b - a) * k
const smooth = (a, b, v) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k) }
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Alles Geometrische aus der Fenstergröße (viewport-relativ, 375x667 bis 1280x800).
function measure(w, h) {
  const earth = Math.round(Math.min(w * 1.3, h, 820)) // Canvas-Kantenlänge
  const D = earth * GLOBE_DISC_RATIO // Durchmesser der sichtbaren Scheibe
  const cy = h - D * (VISIBLE - 0.5) // Scheibenmitte (unten angeschnitten)
  return {
    w, h, earth, D,
    top: cy - earth / 2,
    B: Math.max(40, Math.min(72, Math.min(w, h) * 0.14)), // Würfelgröße in px bei Skalierung 1
    cx: w / 2, cy, R: D / 2, // Scheibenmitte und Radius
    sx: w / 2, sy: cy - D * 0.4, // Start: HINTER der Scheibe, unter dem oberen Rand
  }
}

const readSize = () => measure(window.innerWidth, window.innerHeight)

// Rakete als Vektorgrafik im flachen Stil der Planeten (Nase oben, Düse unten bei
// y = 152 von 170). Bullauge = Würfelauge mit fünf Punkten, so bleibt die
// Würfel-Identität erhalten. Die Flamme sitzt als eigene DOM-Ebene an der Düse.
function RocketArt() {
  return (
    <svg className="launch-rocket-svg" viewBox="0 0 100 170" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="lrBody" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#eef1ff" />
          <stop offset="1" stopColor="#aeb8e0" />
        </linearGradient>
        <linearGradient id="lrNose" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ff6b84" />
          <stop offset="0.6" stopColor="#e0334f" />
          <stop offset="1" stopColor="#a8203b" />
        </linearGradient>
        <clipPath id="lrClip">
          <path d="M50 4 C71 24 78 58 78 100 L78 142 L22 142 L22 100 C22 58 29 24 50 4 Z" />
        </clipPath>
      </defs>
      {/* mittlere Flosse (hinten) und zwei seitliche Flossen */}
      <path d="M44 112 L56 112 L56 150 L44 150 Z" fill="#9b1c35" />
      <path d="M26 98 C14 112 6 130 5 160 L30 142 Z" fill="#e0334f" />
      <path d="M26 98 C20 112 14 126 12 140 L30 130 Z" fill="#ff7a90" opacity="0.55" />
      <path d="M74 98 C86 112 94 130 95 160 L70 142 Z" fill="#b82640" />
      {/* Rumpf */}
      <g clipPath="url(#lrClip)">
        <rect x="0" y="0" width="100" height="170" fill="url(#lrBody)" />
        <rect x="0" y="0" width="100" height="50" fill="url(#lrNose)" />
        <rect x="0" y="116" width="100" height="9" fill="#e0334f" />
        <path d="M30 40 C27 62 27 90 30 130 L36 130 C33 90 33 62 36 40 Z" fill="#fff" opacity="0.55" />
      </g>
      <path d="M50 4 C71 24 78 58 78 100 L78 142 L22 142 L22 100 C22 58 29 24 50 4 Z" fill="none" stroke="#7d87b3" strokeWidth="1.2" />
      {/* Bullauge mit Würfelauge (5) */}
      <circle cx="50" cy="80" r="19" fill="#5a6aa8" />
      <circle cx="50" cy="80" r="15.5" fill="#f4f7ff" />
      <g fill="#1b2167">
        <circle cx="43.5" cy="73.5" r="3" />
        <circle cx="56.5" cy="73.5" r="3" />
        <circle cx="50" cy="80" r="3" />
        <circle cx="43.5" cy="86.5" r="3" />
        <circle cx="56.5" cy="86.5" r="3" />
      </g>
      {/* Düse */}
      <path d="M35 142 L65 142 L70 153 L30 153 Z" fill="#4a4f7a" />
      <rect x="35" y="142" width="30" height="3" fill="#2b2f58" />
    </svg>
  )
}

export default function LaunchSplash({ onDone }) {
  const [L, setL] = useState(readSize)
  const [muted, setMuted] = useState(isSoundMuted)

  const layoutRef = useRef(L)
  layoutRef.current = L
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const stageRef = useRef(null)
  const globeRef = useRef(null)
  const rocketRef = useRef(null)
  const glowRef = useRef(null)
  const flameRefs = useRef([null, null, null])
  const limbRef = useRef(null)
  const flyerRef = useRef(null)
  const emberEls = useRef([])
  const ringRef = useRef(null)
  const flashRef = useRef(null)
  const titleRef = useRef(null)
  const soundRef = useRef(null)

  useEffect(() => {
    const onResize = () => setL(readSize())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const reduced = reducedMotion()
    const T = reduced ? CALM : FULL
    const sound = createLaunchSound({ duration: T.end, passAt: T.pass / T.end })
    soundRef.current = sound

    const stage = stageRef.current
    const rocket = rocketRef.current
    const flyer = flyerRef.current
    const [fOuter, fMid, fInner] = flameRefs.current
    const embers = emberEls.current.map((el) => ({ el, alive: false, born: 0, life: 0, x: 0, y: 0, vx: 0, vy: 0 }))

    let raf = 0
    let t0 = null
    let last = 0
    let crisp = false // will-change ist aus, sobald die Rakete groß ist (scharfes Neurastern)
    let blurPx = -1
    let front = false // Rakete liegt vor der Erde (Umschalten nur, wenn sie frei vom Rand ist)
    let passed = false
    let revealed = false
    let finished = false
    let hidden = false
    let emberAcc = 0

    const flight = makeFlight(layoutRef.current, S_MIN, T.sMax)
    const lastLayout = { l: layoutRef.current }

    function spawnEmber(now, x, y, s) {
      const e = embers.find((m) => !m.alive)
      if (!e) return
      const l = layoutRef.current
      const ub = l.B / 52
      const bs = l.B * s
      // an der Düse, gerade nach unten (Rakete fliegt senkrecht)
      const sp = (140 + Math.random() * 160) * ub * (0.4 + Math.min(s, 3) * 0.4)
      e.alive = true
      e.born = now
      e.life = 450 + Math.random() * 450
      e.x = x + (Math.random() - 0.5) * bs * 0.3
      e.y = y + bs * (NOZZLE + 0.3)
      e.vx = (Math.random() - 0.5) * 60 * ub
      e.vy = sp
      e.k = 0.6 + Math.min(s, 4) * 0.4
      e.el.className = Math.random() < 0.3 ? 'launch-ember is-hot' : 'launch-ember'
    }

    function updateEmbers(now) {
      for (const e of embers) {
        if (!e.alive) continue
        const age = (now - e.born) / 1000
        const k = (age * 1000) / e.life
        if (k >= 1) {
          e.alive = false
          e.el.style.opacity = '0'
          continue
        }
        e.el.style.transform = `translate3d(${(e.x + e.vx * age).toFixed(1)}px,${(e.y + e.vy * age).toFixed(1)}px,0) scale(${(e.k * (1 - 0.7 * k)).toFixed(2)})`
        e.el.style.opacity = (1 - k).toFixed(2)
      }
    }

    function shake(ms) {
      if (ms >= SHAKE_MS) {
        stage.style.transform = ''
        return
      }
      // Klingt exponentiell ab; cos statt sin, damit der Schlag sofort voll da ist.
      const e = Math.exp(-ms / 150)
      const x = e * (9 * Math.cos(ms * 0.058) + 4 * Math.sin(ms * 0.131 + 1))
      const y = e * (7 * Math.cos(ms * 0.071 + 2) + 4 * Math.sin(ms * 0.149))
      const r = e * 1.2 * Math.cos(ms * 0.049 + 0.5)
      stage.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${r.toFixed(2)}deg)`
    }

    function frame(ts) {
      raf = requestAnimationFrame(frame)
      if (t0 === null) {
        t0 = ts
        // Erst hier starten (nicht beim Mount): StrictMode räumt den ersten
        // Effekt-Lauf ab, bevor ein Frame kam -> nur EIN AudioContext.
        sound.start()
      }
      const t = ts - t0
      const dt = last ? Math.min(ts - last, 64) : 16
      last = ts
      const l = layoutRef.current

      const p = clamp01(t / T.pass) // Fortschritt der Bahn
      const post = Math.max(0, t - T.pass) // ms nach dem Vorbeiflug
      const pk = clamp01(post / T.post)

      // --- Pose: alles aus p ---
      // Layout kann sich per Resize ändern -> Bahn neu aufbauen (selten)
      if (lastLayout.l !== l) {
        lastLayout.l = l
        Object.assign(flight, makeFlight(l, S_MIN, T.sMax))
      }
      const [x, y] = flight.path(p)
      const s = p < 1 ? flight.scaleAt(p) : T.sMax * (1 + 0.5 * pk)
      const flY = flameY(p)
      const flX = lerp(0.8, 1.7, p)
      const glow = lerp(0.45, 1, p)
      const op = 1 - pk
      const bs = l.B * s

      // Z-Reihenfolge: erst vor die Erde, wenn die ganze Rakete samt Flammenspitze
      // über dem Rand der Scheibe liegt -> kein sichtbarer Sprung. (Bahn so gelegt,
      // dass das in jedem Seitenverhältnis früh passiert, siehe launchFlight.js.)
      if (!front && flight.clearAt(p, y)) {
        front = true
        flyer.style.zIndex = '2'
      }

      if (!hidden) {
        if (op <= 0) {
          hidden = true
          rocket.style.opacity = '0'
        } else {
          rocket.style.opacity = op.toFixed(2)
          rocket.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${(s / RES).toFixed(5)})`
          // Bei großer Darstellung will-change abschalten: Chrome rastert ein
          // will-change-Element nur einmal und skaliert es dann hoch (unscharf).
          if (!crisp && s > 1.2) {
            crisp = true
            rocket.style.willChange = 'auto'
          }
          const fl = () => 1 + (Math.random() - 0.5) * 0.24
          const sx = flX.toFixed(2)
          fOuter.style.transform = `scale(${sx},${(flY * fl()).toFixed(2)})`
          fMid.style.transform = `scale(${sx},${(flY * fl()).toFixed(2)})`
          fInner.style.transform = `scale(${sx},${(flY * fl()).toFixed(2)})`
          glowRef.current.style.opacity = glow.toFixed(2)
          // Bewegungsunschärfe erst kurz vor dem Vorbeiflug; in 0,5px-Stufen, damit
          // der Filter nicht jeden Frame neu gesetzt wird.
          if (!reduced) {
            const bl = Math.round((5 * smooth(0.82, 1, p) + 7 * pk) * 2) / 2
            if (bl !== blurPx) {
              blurPx = bl
              rocket.style.filter = bl > 0 ? `blur(${bl}px)` : ''
            }
          }
        }
      }

      // Schein am oberen Rand der Erde: kündigt die aufsteigende Rakete an und
      // leuchtet die Kante an, während sie auftaucht.
      const rim = smooth(0.04, 0.26, p) * (1 - 0.85 * smooth(0.3, 0.7, p))
      limbRef.current.style.opacity = rim.toFixed(2)

      // --- Funken (Pool, DOM-Knoten werden wiederverwendet) ---
      if (!hidden) {
        emberAcc += ((4 + 22 * p) * T.ember * dt) / 1000
        while (emberAcc >= 1) {
          emberAcc -= 1
          spawnEmber(ts, x, y, s)
        }
      }
      updateEmbers(ts)

      // --- Vorbeiflug: Shake, Blitz, Ring, Vibration ---
      if (t >= T.pass && !passed) {
        passed = true
        if (!reduced) {
          // Ring dort, wo die Rakete an der Kamera vorbeizieht
          ringRef.current.style.left = `${l.cx - l.D * 0.25}px`
          ringRef.current.style.top = `${flight.ty - l.D * 0.25}px`
          flashRef.current.classList.add('is-pass')
          ringRef.current.classList.add('is-pass')
          // Chrome blockiert vibrate() ohne vorherige Geste mit einer Konsolenwarnung.
          if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.([30, 40, 60])
        }
      }
      if (passed && !reduced) shake(post)

      if (t >= T.reveal && !revealed) {
        revealed = true
        titleRef.current.classList.add('is-in')
      }

      if (t >= T.end && !finished) {
        finished = true
        cancelAnimationFrame(raf)
        // Länge der Erde ans Menü weitergeben, damit sie dort nicht zurückspringt
        setGlobeHandoff(globeRef.current?.getRotation())
        // Ton klingt von selbst aus (kein stop() im Cleanup, siehe unten)
        soundRef.current = null
        onDoneRef.current?.()
      }
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      // Vorzeitiger Abbruch (Unmount/StrictMode): Ton ausblenden. Nach normalem
      // Ende läuft der Akkord weiter aus.
      if (soundRef.current) sound.stop()
      soundRef.current = null
      stage.style.transform = ''
    }
  }, [])

  const toggleMute = () => {
    const m = !muted
    setMuted(m)
    setSoundMuted(m)
    soundRef.current?.setMuted(m)
  }

  // Würfel-Maße in em, em = B * RES
  const emStyle = { fontSize: L.B * RES }
  return (
    <div className="launch-screen">
      <div ref={stageRef} className="launch-stage" aria-hidden="true">
        <div className="starfield" />

        <div className="launch-earth" style={{ width: L.earth, height: L.earth, top: L.top, marginLeft: -L.earth / 2 }}>
          <Globe ref={globeRef} size={L.earth} speed={EARTH_SPEED} tilt={0} startLon={40} glow />
        </div>
        {/* Schein am oberen Rand der Kugel (über der Erde) */}
        <div
          ref={limbRef}
          className="launch-limb-glow"
          style={{ width: L.D * 0.9, height: L.D * 0.45, left: L.cx - L.D * 0.45, top: L.cy - L.R - L.D * 0.28 }}
        />

        {/* Flieger-Ebene: z-index 0 = hinter der Erde, 2 = davor (JS schaltet um) */}
        <div ref={flyerRef} className="launch-flyer">
        <div className="launch-embers">
          {Array.from({ length: MAX_EMBERS }, (_, i) => (
            <span key={i} ref={(el) => { emberEls.current[i] = el }} className="launch-ember" />
          ))}
        </div>

        {/* Rakete: Würfel oben, dreilagige Flamme unten */}
        <div ref={rocketRef} className="launch-rocket" style={emStyle}>
          <div ref={glowRef} className="launch-rocket-glow" />
          <RocketArt />
          <div className="launch-flame">
            <div ref={(el) => { flameRefs.current[0] = el }} className="launch-flame-l launch-flame-outer" />
            <div ref={(el) => { flameRefs.current[1] = el }} className="launch-flame-l launch-flame-mid" />
            <div ref={(el) => { flameRefs.current[2] = el }} className="launch-flame-l launch-flame-inner" />
          </div>
        </div>
        </div>

        <div
          ref={ringRef}
          className="launch-ring"
          style={{ width: L.D * 0.5, height: L.D * 0.5 }}
        />
        <div ref={flashRef} className="launch-flash" />

        <div className="launch-title-wrap">
          <div ref={titleRef} className="launch-title">
            <span className="splash-title-a">KARACHO</span>
            <span className="splash-title-b">KNIFFEL</span>
          </div>
        </div>
      </div>

      {/* Außerhalb der Shake-Ebene und als einziges Element nicht aria-hidden */}
      <button
        type="button"
        className="launch-mute"
        onClick={toggleMute}
        aria-label={muted ? 'Ton einschalten' : 'Ton ausschalten'}
      >
        <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
      </button>
      <span className="launch-sr" role="status">Karacho Kniffel wird geladen</span>
    </div>
  )
}
