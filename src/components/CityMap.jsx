import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDuration } from '../lib/cityStats'
import { WORLD_RINGS } from '../lib/worldLand'

const ACCENT = 'var(--accent-cyan)'
const GOLD = '#ffc400'
const GRID = 'rgba(255,255,255,0.12)'
const LAND = 'rgba(255,255,255,0.07)'
const COAST = 'rgba(255,255,255,0.16)'
const MUTED = 'var(--text-faint)'
const MEDALS = ['🥇', '🥈', '🥉']

const W = 320
const H = 220
const PAD = 24

// Mindestspanne in Grad. Ohne die würde eine einzige Stadt auf Straßenniveau
// gezoomt. Großzügig gewählt: Bei zwei Städten im selben Land zeigt ein enger
// Ausschnitt zwar die Blasen richtig, aber keine wiedererkennbare Küstenlinie —
// und damit sieht die Karte nicht nach Karte aus.
const MIN_SPAN_DEG = 30

const RAD = Math.PI / 180

// Zoomstufen der Karte. Unter 1 geht es heraus, damit man das Land um die
// Städte herum sehen kann; die Obergrenze reicht bis auf Stadtniveau.
const MIN_ZOOM = 0.5
const MAX_ZOOM = 16
// So weit darf die Mitte des Ausschnitts vom Startbild wegwandern, sonst
// verschiebt man die Karte ins Leere.
const MAX_PAN = 3
// Ab dieser Strecke in px ist ein Fingerdruck ein Ziehen und kein Antippen.
const DRAG_PX = 5

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Web-Mercator. x und y kommen beide in Radiant heraus, damit derselbe Maßstab
// für beide Achsen gilt — sonst wäre die Karte verzerrt und die Projektion für
// nichts zu haben.
function projectLngLat(lng, lat) {
  const clamped = Math.max(-85, Math.min(85, lat))
  return {
    x: lng * RAD,
    y: Math.log(Math.tan(Math.PI / 4 + (clamped * RAD) / 2)),
  }
}

const project = (city) => projectLngLat(city.lng, city.lat)

// Gitterweite so, dass etwa vier bis sechs Linien pro Achse stehen.
const STEPS = [1, 2, 5, 10, 20, 45]
function gridStep(spanDeg) {
  return STEPS.find((s) => spanDeg / s <= 6) ?? 45
}

// Cyan (ACCENT) -> GOLD, je länger pro Gerät gespielt wird.
function heat(t) {
  const from = [0x3c, 0xcf, 0xff]
  const to = [0xff, 0xc4, 0x00]
  const k = Math.max(0, Math.min(1, t))
  const rgb = from.map((v, i) => Math.round(v + (to[i] - v) * k))
  return `rgb(${rgb.join(',')})`
}

function Empty({ text }) {
  return (
    <div style={{ color: MUTED, fontSize: 13, padding: '12px 0' }}>{text}</div>
  )
}

// Ausschnitt, Länderumrisse, Gradnetz und Blasenpositionen — alles hängt allein
// an den Städten und wird deshalb gemeinsam gemerkt. Ohne das würden bei jedem
// Antippen einer Stadt gut viertausend Punkte umsonst projiziert.
function buildView(cities) {
  const plotted = cities.filter(
    (c) => Number.isFinite(c.lat) && Number.isFinite(c.lng),
  )
  if (plotted.length === 0) return null

  const points = plotted.map((c) => ({ city: c, ...project(c) }))
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2

  const minSpan = MIN_SPAN_DEG * RAD
  const spanX = Math.max(Math.max(...xs) - Math.min(...xs), minSpan)
  const spanY = Math.max(Math.max(...ys) - Math.min(...ys), minSpan)
  const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY)

  const sx = (x) => W / 2 + (x - cx) * scale
  const sy = (y) => H / 2 - (y - cy) * scale // Nord oben

  // Länderumrisse (src/lib/worldLand.js, erzeugt von scripts/build-world.mjs).
  // Was aus dem Bild läuft, schneidet das svg von selbst ab — und kommt beim
  // Verschieben und Herauszoomen wieder ins Bild.
  const land = WORLD_RINGS.map((ring) => {
    let d = ''
    for (let i = 0; i < ring.length; i += 2) {
      const p = projectLngLat(ring[i], ring[i + 1])
      d += `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`
    }
    return `${d}Z`
  })

  // Gitter in Ganzgrad-Schritten, abgeleitet aus dem sichtbaren Ausschnitt.
  const stepLng = gridStep(W / scale / RAD)
  const centerLat = Math.atan(Math.sinh(cy)) / RAD
  const lines = []
  // Das Gitter reicht weit über das Startbild hinaus, damit beim Verschieben
  // und Herauszoomen keine Lücken entstehen.
  const X0 = -MAX_PAN * W
  const X1 = (MAX_PAN + 1) * W
  const Y0 = -MAX_PAN * H
  const Y1 = (MAX_PAN + 1) * H
  for (let i = -24; i <= 24; i++) {
    const lng = Math.round(cx / RAD / stepLng + i) * stepLng
    const x = sx(lng * RAD)
    if (x > X0 && x < X1) lines.push({ key: `v${lng}`, x1: x, x2: x, y1: Y0, y2: Y1 })

    const lat = Math.round(centerLat / stepLng + i) * stepLng
    if (Math.abs(lat) > 85) continue
    const y = sy(Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)))
    if (y > Y0 && y < Y1) lines.push({ key: `h${lat}`, x1: X0, x2: X1, y1: y, y2: y })
  }

  return { land, lines, dots: points.map((p) => ({ city: p.city, x: sx(p.x), y: sy(p.y) })) }
}

// Verschieben und Zoomen der Karte. Der Zustand ist eine Transformation im
// viewBox-Raum: Punkt p landet bei p * k + (tx, ty). Maus (Ziehen, Mausrad) und
// Touch (ein Finger zieht, zwei Finger zoomen) laufen über Pointer Events,
// damit es nur einen Weg gibt.
function usePanZoom() {
  const [t, setT] = useState({ k: 1, tx: 0, ty: 0 })
  const svgRef = useRef(null)
  const pointers = useRef(new Map())
  const lastDist = useRef(1) // Fingerabstand beim letzten Zoom-Schritt
  const moved = useRef(false)

  // Zoom um einen Punkt (in viewBox-Einheiten), der dabei stehen bleibt.
  function zoomAt(factor, px, py) {
    setT((cur) => {
      const k = clamp(cur.k * factor, MIN_ZOOM, MAX_ZOOM)
      const f = k / cur.k
      return limit({ k, tx: px - (px - cur.tx) * f, ty: py - (py - cur.ty) * f })
    })
  }

  // Hält die Mitte des Ausschnitts in Reichweite des Startbilds.
  function limit({ k, tx, ty }) {
    const cx = (W / 2 - tx) / k
    const cy = (H / 2 - ty) / k
    const nx = clamp(cx, -MAX_PAN * W, (MAX_PAN + 1) * W)
    const ny = clamp(cy, -MAX_PAN * H, (MAX_PAN + 1) * H)
    return { k, tx: W / 2 - nx * k, ty: H / 2 - ny * k }
  }

  // Bildschirm-px -> viewBox-Einheiten. meet-Skalierung: die Karte ist gleich
  // breit wie hoch skaliert, das svg-Rechteck kann aber ein anderes Verhältnis
  // haben.
  function toView(clientX, clientY) {
    const r = svgRef.current.getBoundingClientRect()
    const scale = Math.min(r.width / W, r.height / H)
    const offX = (r.width - W * scale) / 2
    const offY = (r.height - H * scale) / 2
    return {
      x: (clientX - r.left - offX) / scale,
      y: (clientY - r.top - offY) / scale,
      scale,
    }
  }

  // Mausrad muss die Seite anhalten, das geht nur mit einem nicht-passiven
  // Listener — React hängt seine Wheel-Handler passiv an.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    function onWheel(e) {
      e.preventDefault()
      const { x, y } = toView(e.clientX, e.clientY)
      zoomAt(Math.exp(-e.deltaY * 0.0015), x, y)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  const handlers = {
    onPointerDown(e) {
      // sx/sy: Startpunkt, an dem sich entscheidet, ob es ein Ziehen wird.
      pointers.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        sx: e.clientX,
        sy: e.clientY,
      })
      moved.current = false
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()]
        lastDist.current = Math.hypot(a.x - b.x, a.y - b.y) || 1
        moved.current = true
        svgRef.current.setPointerCapture?.(e.pointerId)
      }
    },
    onPointerMove(e) {
      const prev = pointers.current.get(e.pointerId)
      if (!prev) return
      const cur = { ...prev, x: e.clientX, y: e.clientY }
      pointers.current.set(e.pointerId, cur)

      // Zwei Finger: pro Schritt um das Verhältnis zur letzten Distanz zoomen.
      if (pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
        const mid = toView((a.x + b.x) / 2, (a.y + b.y) / 2)
        zoomAt(dist / lastDist.current, mid.x, mid.y)
        lastDist.current = dist
        return
      }

      // Ein Finger: erst ab einer Mindeststrecke ziehen. Ein Antippen einer
      // Blase darf nicht verrutschen, und der Pointer wird erst dann gefangen
      // (sonst käme der Klick nie bei der Blase an).
      if (!moved.current) {
        if (Math.hypot(cur.x - cur.sx, cur.y - cur.sy) < DRAG_PX) return
        moved.current = true
        svgRef.current.setPointerCapture?.(e.pointerId)
      }
      const { scale } = toView(0, 0)
      const dx = (cur.x - prev.x) / scale
      const dy = (cur.y - prev.y) / scale
      setT((t0) => limit({ k: t0.k, tx: t0.tx + dx, ty: t0.ty + dy }))
    },
    onPointerUp(e) {
      pointers.current.delete(e.pointerId)
    },
    onPointerCancel(e) {
      pointers.current.delete(e.pointerId)
    },
    onDoubleClick(e) {
      const { x, y } = toView(e.clientX, e.clientY)
      zoomAt(2, x, y)
    },
  }

  return {
    t,
    svgRef,
    handlers,
    // true, wenn der letzte Druck ein Ziehen war — dann kein Antippen werten.
    wasDrag: () => moved.current,
    zoomBy: (f) => zoomAt(f, W / 2, H / 2),
    reset: () => setT({ k: 1, tx: 0, ty: 0 }),
    atRest: t.k === 1 && t.tx === 0 && t.ty === 0,
  }
}

function MapButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: '1px solid var(--glass-border)',
        background: 'rgba(11, 16, 48, 0.72)',
        color: 'white',
        fontSize: 20,
        lineHeight: 1,
        cursor: 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}

// Blasen-Karte plus Städte-Rangliste. Der Ausschnitt richtet sich nach den
// echten Daten, die Karte funktioniert damit für eine Stadt wie für die Welt.
export default function CityMap({ cities = [] }) {
  const [selected, setSelected] = useState(null)
  const { t, svgRef, handlers, wasDrag, zoomBy, reset, atRest } = usePanZoom()
  // Muss über dem frühen return stehen — Hooks laufen sonst nicht in jeder
  // Runde in derselben Reihenfolge.
  const view = useMemo(() => buildView(cities), [cities])

  if (cities.length === 0) {
    return <Empty text="Noch keine Städte-Daten." />
  }

  const maxPlayers = Math.max(...cities.map((c) => c.players), 1)
  const maxPerDevice = Math.max(
    ...cities.map((c) => c.totalSeconds / Math.max(c.players, 1)),
    1,
  )

  // Nur die größten Blasen bekommen ein Label, sonst überlagern sich die Texte.
  const labelled = new Set(
    (view?.dots ?? [])
      .map((d) => d.city)
      .sort((a, b) => b.players - a.players)
      .slice(0, 5)
      .map((c) => c.city),
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {view && (
        <div style={{ position: 'relative', width: '100%', maxWidth: 480, margin: '0 auto' }}>
          <svg
            ref={svgRef}
            {...handlers}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Karte der Städte. Ziehen verschiebt, zwei Finger oder Mausrad zoomen."
            style={{
              width: '100%',
              height: 'auto',
              aspectRatio: `${W} / ${H}`,
              // Auf Tablet und Laptop nicht größer als ein Bildschirmteil.
              maxHeight: 'min(48vh, 340px)',
              display: 'block',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 'var(--radius-sm)',
              // Im Grundzustand darf die Seite per Wisch scrollen; sobald die
              // Karte bewegt ist, gehört die Geste ihr (siehe usePanZoom).
              touchAction: atRest ? 'pan-y' : 'none',
              cursor: 'grab',
            }}
          >
            <g transform={`translate(${t.tx} ${t.ty}) scale(${t.k})`}>
              {view.land.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill={LAND}
                  stroke={COAST}
                  strokeWidth={0.5}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {view.lines.map((l) => (
                <line
                  key={l.key}
                  x1={l.x1}
                  x2={l.x2}
                  y1={l.y1}
                  y2={l.y2}
                  stroke={GRID}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {view.dots.map(({ city: c, x, y }) => {
                // Blasen und Schrift bleiben beim Zoomen gleich groß am
                // Bildschirm; die Karte darunter wächst.
                const r = (4 + 9 * Math.sqrt(c.players / maxPlayers)) / t.k
                const fill = heat(
                  c.totalSeconds / Math.max(c.players, 1) / maxPerDevice,
                )
                const active = selected === c.city
                return (
                  <g
                    key={`${c.city}-${c.country}`}
                    onClick={() => {
                      if (wasDrag()) return
                      setSelected(active ? null : c.city)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={r}
                      fill={fill}
                      fillOpacity={active ? 0.85 : 0.45}
                      stroke={fill}
                      strokeWidth={(active ? 2 : 1) / t.k}
                    />
                    {(active || t.k >= 3 || (t.k >= 1 && labelled.has(c.city))) && (
                      <text
                        x={x}
                        y={y - r - 4 / t.k}
                        // Als style: ein fill-Attribut versteht var(--…) nicht
                        // und fiele auf Schwarz zurück.
                        style={{ fill: active ? 'white' : MUTED }}
                        fontSize={9 / t.k}
                        textAnchor="middle"
                      >
                        {c.city}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>

          <div
            style={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              display: 'flex',
              gap: 6,
            }}
          >
            <MapButton label="Hineinzoomen" onClick={() => zoomBy(1.6)}>+</MapButton>
            <MapButton label="Herauszoomen" onClick={() => zoomBy(1 / 1.6)}>−</MapButton>
            <MapButton label="Ansicht zurücksetzen" onClick={reset} disabled={atRest}>⟲</MapButton>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 14,
          color: MUTED,
          fontSize: 10,
        }}
      >
        <span>◯ Größe = Spieler</span>
        <span style={{ color: GOLD }}>● Farbe = Ø Spielzeit</span>
      </div>

      {cities.map((c, i) => {
        const active = selected === c.city
        return (
          <div
            key={`${c.city}-${c.country}`}
            onClick={() => setSelected(active ? null : c.city)}
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              padding: '9px 0',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: active ? ACCENT : 'white',
              }}
            >
              <span style={{ width: 22, color: MUTED, fontSize: 12 }}>
                {MEDALS[i] ?? i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 15 }}>
                {c.city}
                {c.country && (
                  <span style={{ color: MUTED, fontSize: 11 }}> {c.country}</span>
                )}
              </span>
              <span style={{ color: MUTED, fontSize: 12 }}>
                {c.players} Spieler
              </span>
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 'bold',
                  minWidth: 68,
                  textAlign: 'right',
                }}
              >
                {formatDuration(c.totalSeconds)}
              </span>
            </div>

            {active && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  color: MUTED,
                  fontSize: 11,
                  paddingLeft: 30,
                  marginTop: 6,
                }}
              >
                <span>{c.sessions} Sitzungen</span>
                <span>
                  Ø {formatDuration(c.totalSeconds / Math.max(c.sessions, 1))} pro
                  Sitzung
                </span>
                <span>
                  Ø {formatDuration(c.totalSeconds / Math.max(c.players, 1))} pro
                  Spieler
                </span>
                {c.lastSeen && (
                  <span>
                    zuletzt{' '}
                    {new Date(c.lastSeen).toLocaleDateString('de-AT', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
