import { useState } from 'react'
import { formatDuration } from '../lib/cityStats'

const PURPLE = '#b388ff'
const GOLD = '#ffc400'
const GRID = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'
const MEDALS = ['🥇', '🥈', '🥉']

const W = 320
const H = 220
const PAD = 24

// Mindestspanne in Grad. Ohne die würde eine einzige Stadt auf Straßenniveau
// gezoomt und das Gitter wäre sinnlos.
const MIN_SPAN_DEG = 8

const RAD = Math.PI / 180

// Web-Mercator. x und y kommen beide in Radiant heraus, damit derselbe Maßstab
// für beide Achsen gilt — sonst wäre die Karte verzerrt und die Projektion für
// nichts zu haben.
function project(city) {
  const lat = Math.max(-85, Math.min(85, city.lat))
  return {
    x: city.lng * RAD,
    y: Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)),
  }
}

// Gitterweite so, dass etwa vier bis sechs Linien pro Achse stehen.
const STEPS = [1, 2, 5, 10, 20, 45]
function gridStep(spanDeg) {
  return STEPS.find((s) => spanDeg / s <= 6) ?? 45
}

// PURPLE -> GOLD, je länger pro Gerät gespielt wird.
function heat(t) {
  const from = [0xb3, 0x88, 0xff]
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

// Blasen-Karte plus Städte-Rangliste. Der Ausschnitt richtet sich nach den
// echten Daten, die Karte funktioniert damit für eine Stadt wie für die Welt.
export default function CityMap({ cities = [] }) {
  const [selected, setSelected] = useState(null)

  if (cities.length === 0) {
    return (
      <Empty
        text={
          'Noch keine Städte-Daten. Eine Stadt erscheint erst, wenn mindestens ' +
          'drei Geräte von dort gespielt haben.'
        }
      />
    )
  }

  const plotted = cities.filter(
    (c) => Number.isFinite(c.lat) && Number.isFinite(c.lng),
  )
  const maxPlayers = Math.max(...cities.map((c) => c.players), 1)
  const perDevice = cities.map((c) => c.totalSeconds / Math.max(c.players, 1))
  const maxPerDevice = Math.max(...perDevice, 1)

  // Nur die größten Blasen bekommen ein Label, sonst überlagern sich die Texte.
  const labelled = new Set(
    [...plotted]
      .sort((a, b) => b.players - a.players)
      .slice(0, 5)
      .map((c) => c.city),
  )

  let map = null
  if (plotted.length > 0) {
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

    // Gitter in Ganzgrad-Schritten, abgeleitet aus dem sichtbaren Ausschnitt.
    const stepLng = gridStep((W / scale) / RAD)
    const centerLat = Math.atan(Math.sinh(cy)) / RAD
    const lines = []
    for (let i = -6; i <= 6; i++) {
      const lng = Math.round(cx / RAD / stepLng + i) * stepLng
      const x = sx(lng * RAD)
      if (x > 0 && x < W) lines.push({ key: `v${lng}`, x1: x, x2: x, y1: 0, y2: H })

      const lat = Math.round(centerLat / stepLng + i) * stepLng
      if (Math.abs(lat) > 85) continue
      const y = sy(Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)))
      if (y > 0 && y < H) lines.push({ key: `h${lat}`, x1: 0, x2: W, y1: y, y2: y })
    }

    map = (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{
          width: '100%',
          height: 'auto',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 10,
        }}
      >
        {lines.map((l) => (
          <line
            key={l.key}
            x1={l.x1}
            x2={l.x2}
            y1={l.y1}
            y2={l.y2}
            stroke={GRID}
          />
        ))}
        {points.map(({ city: c, x, y }) => {
          const r = 4 + 9 * Math.sqrt(c.players / maxPlayers)
          const fill = heat(c.totalSeconds / Math.max(c.players, 1) / maxPerDevice)
          const active = selected === c.city
          return (
            <g
              key={`${c.city}-${c.country}`}
              onClick={() => setSelected(active ? null : c.city)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={sx(x)}
                cy={sy(y)}
                r={r}
                fill={fill}
                fillOpacity={active ? 0.85 : 0.45}
                stroke={fill}
                strokeWidth={active ? 2 : 1}
              />
              {(labelled.has(c.city) || active) && (
                <text
                  x={sx(x)}
                  y={sy(y) - r - 4}
                  fill={active ? 'white' : MUTED}
                  fontSize="9"
                  textAnchor="middle"
                >
                  {c.city}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {map}

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
                color: active ? PURPLE : 'white',
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
