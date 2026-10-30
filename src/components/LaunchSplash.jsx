// Ladebildschirm: Ein Würfel (SVG, drei sichtbare Flächen, Fünf nach vorn)
// startet VERDECKT hinter der (echten, drehenden) Erde, taucht am oberen Rand
// der Kugel auf, fliegt senkrecht (ohne Drehen/Pendeln) auf den Spieler zu, das
// Triebwerk sitzt HINTER ihm (Schein, Flammenzungen, Strahlen), rauscht an der
// Kamera vorbei
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
import { makeFlight, thrust } from '../lib/launchFlight'

// So früh wie möglich anstoßen (läuft schon beim Import in App.jsx), damit die
// Landmassen-Textur beim ersten Frame fertig ist.
preloadGlobe()

// ---- Zeitleiste (ms ab erstem Frame) ---------------------------------------
// pass: Würfel rauscht an der Kamera vorbei (p = 1, Shake/Blitz, Ton-passAt)
// reveal: Titel erscheint (Ton-Akkord liegt bei pass + 200 ms)  |  end: onDone
// Zwischen reveal und end bleibt ein ruhiger Moment, in dem der Titel steht.
const FULL = { pass: 3300, reveal: 3500, end: 5000, sMax: 14, post: 220, ember: 1 }
// Bewegung reduziert: kürzer, kleiner, ohne Shake/Blitz/Vibration.
const CALM = { pass: 1700, reveal: 1900, end: 3200, sMax: 4.5, post: 500, ember: 0.4 }

const RES = 4 // Würfel wird 4x größer gerastert und runterskaliert -> bleibt beim Heranfliegen scharf
const S_MIN = 0.16 // Anfangsgröße (Vielfaches der Würfelgröße-Einheit B)
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

// Würfel als Vektorgrafik, Farben wie components/Die.jsx (Weiß -> helles Lila,
// dunkle Augen). Schräg von rechts oben gesehen: Vorderseite (5), Oberseite (3)
// und rechte Seite (1) sind verschieden schattiert, so wirkt er körperlich. Die
// Neigung ist fest eingezeichnet (kein Drehen). Rundung über abgerundete Kanten
// (dicke Kontur in Flächenfarbe). Mitte der Zeichnung = Mitte der 100x100-Box.
const PIP = '#1b2167'
function Pips({ pts, r, m }) {
  return (
    <g transform={m}>
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={r} fill={PIP} />)}
    </g>
  )
}
function DieArt() {
  return (
    <svg className="launch-die" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ldFront" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9d4e8" />
        </linearGradient>
        <linearGradient id="ldTop" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#f6f3ff" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="ldSide" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b9b2dc" />
          <stop offset="1" stopColor="#8f88c4" />
        </linearGradient>
      </defs>
      {/* rechte Seite (1) und Oberseite (3), je mit Randlinie für gerundete Ecken */}
      <path d="M69 31 L92 12 L92 70 L69 89 Z" fill="url(#ldSide)" stroke="#9b94cf" strokeWidth="4" strokeLinejoin="round" />
      <path d="M10 31 L33 12 L92 12 L69 31 Z" fill="url(#ldTop)" stroke="#ece8fb" strokeWidth="4" strokeLinejoin="round" />
      {/* Vorderseite (5) */}
      <rect x="10" y="31" width="59" height="58" rx="5" fill="url(#ldFront)" stroke="#e9e5f6" strokeWidth="4" strokeLinejoin="round" />
      <Pips r={5} m="translate(10 31)" pts={[[13, 13], [46, 13], [29.5, 29], [13, 45], [46, 45]]} />
      {/* Oberseite: Einheitsquadrat auf das Parallelogramm abgebildet */}
      <Pips r={0.085} m="matrix(59 0 23 -19 10 31)" pts={[[0.25, 0.75], [0.5, 0.5], [0.75, 0.25]]} />
      {/* rechte Seite */}
      <Pips r={0.085} m="matrix(23 -19 0 58 69 31)" pts={[[0.5, 0.5]]} />
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
  const dieRef = useRef(null)
  const exhaustRefs = useRef([]) // Triebwerk hinter dem Würfel: Schein, 3 Flammenlagen, Strahlen
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
    const dieEl = dieRef.current
    const flyer = flyerRef.current
    const [exCorona, exOuter, exMid, exInner, exStreaks] = exhaustRefs.current
    const embers = emberEls.current.map((el) => ({ el, alive: false, born: 0, life: 0, x: 0, y: 0, vx: 0, vy: 0 }))

    let raf = 0
    let t0 = null
    let last = 0
    let crisp = false // will-change ist aus, sobald der Würfel groß ist (scharfes Neurastern)
    let blurPx = -1
    let front = false // Würfel liegt vor der Erde (Umschalten nur, wenn sie frei vom Rand ist)
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
      const bs = Math.min(l.B * s, 170) // Funken-Tempo wächst mit dem Würfel, aber nicht ins Unendliche
      // Funken entstehen hinter dem Würfel und strömen in alle Richtungen nach außen
      // (Würfel fliegt auf uns zu: aus unserer Sicht wandern sie radial weg und
      // werden dabei größer)
      const a = Math.random() * Math.PI * 2
      e.alive = true
      e.born = now
      e.life = 450 + Math.random() * 450
      e.x = x + Math.cos(a) * l.B * s * 0.3
      e.y = y + Math.sin(a) * l.B * s * 0.3
      const sp = bs * (1.2 + Math.random() * 2.2)
      e.vx = Math.cos(a) * sp
      e.vy = Math.sin(a) * sp
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
        e.el.style.transform = `translate3d(${(e.x + e.vx * age).toFixed(1)}px,${(e.y + e.vy * age).toFixed(1)}px,0) scale(${(e.k * (0.6 + 1.2 * k)).toFixed(2)})`
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
      const th = (thrust(p) - 0.5) / 1.4 // Schub 0..1, wächst mit dem Flug
      const fade = 1 - smooth(0.9, 1, p) // Triebwerk blendet in der Schluss-Unschärfe aus
      const op = 1 - pk
      const bs = l.B * s

      // Z-Reihenfolge: erst vor die Erde, wenn der ganze Würfel samt Schein
      // über dem Rand der Scheibe liegt -> kein sichtbarer Sprung. (Bahn so gelegt,
      // dass das in jedem Seitenverhältnis früh passiert, siehe launchFlight.js.)
      if (!front && flight.clearAt(p, y)) {
        front = true
        flyer.style.zIndex = '2'
      }

      if (!hidden) {
        if (op <= 0) {
          hidden = true
          dieEl.style.opacity = '0'
        } else {
          dieEl.style.opacity = op.toFixed(2)
          dieEl.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${(s / RES).toFixed(5)})`
          // Bei großer Darstellung will-change abschalten: Chrome rastert ein
          // will-change-Element nur einmal und skaliert es dann hoch (unscharf).
          if (!crisp && s > 1.2) {
            crisp = true
            dieEl.style.willChange = 'auto'
          }
          // Triebwerk: nur transform/opacity. Jede Lage flackert für sich (Zufall in
          // der Größe, nicht in der Drehung), wächst mit Schub und Würfelgröße.
          const fl = () => 1 + (Math.random() - 0.5) * 0.16
          const ex = (el, size, op) => {
            el.style.transform = `scale(${(size * fl()).toFixed(3)})`
            el.style.opacity = (op * fade).toFixed(2)
          }
          ex(exCorona, lerp(0.8, 1.3, th), lerp(0.45, 1, th))
          ex(exOuter, lerp(0.6, 1.25, th), lerp(0.5, 0.95, th))
          ex(exMid, lerp(0.5, 1.05, th), lerp(0.55, 1, th))
          ex(exInner, lerp(0.4, 0.8, th), lerp(0.6, 1, th))
          exStreaks.style.transform = `scale(${lerp(0.7, 1.4, th).toFixed(3)})`
          exStreaks.style.opacity = (0.75 * smooth(0.2, 0.8, p) * fade).toFixed(2)
          // Bewegungsunschärfe erst kurz vor dem Vorbeiflug; in 0,5px-Stufen, damit
          // der Filter nicht jeden Frame neu gesetzt wird.
          if (!reduced) {
            const bl = Math.round((5 * smooth(0.82, 1, p) + 7 * pk) * 2) / 2
            if (bl !== blurPx) {
              blurPx = bl
              dieEl.style.filter = bl > 0 ? `blur(${bl}px)` : ''
            }
          }
        }
      }

      // Schein am oberen Rand der Erde: kündigt den aufsteigenden Würfel an und
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
          // Ring dort, wo der Würfel an der Kamera vorbeizieht
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

        {/* Würfel mit Triebwerk dahinter */}
        <div ref={dieRef} className="launch-die-box" style={emStyle}>
          {/* Triebwerk HINTER dem Würfel (steht im DOM davor, die Zeichnung liegt obenauf) */}
          <div ref={(el) => { exhaustRefs.current[0] = el }} className="launch-ex launch-ex-corona" />
          <div ref={(el) => { exhaustRefs.current[4] = el }} className="launch-ex launch-ex-streaks" />
          <div ref={(el) => { exhaustRefs.current[1] = el }} className="launch-ex launch-ex-outer" />
          <div ref={(el) => { exhaustRefs.current[2] = el }} className="launch-ex launch-ex-mid" />
          <div ref={(el) => { exhaustRefs.current[3] = el }} className="launch-ex launch-ex-inner" />
          <DieArt />
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
