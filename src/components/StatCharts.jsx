import { useState } from 'react'
import { currentStreak } from '../logic/stats'
import { pairRate, strongestHabits, ORDER_INDICES } from '../logic/orderStats'
import { topFace } from '../logic/kniffelFaces'
import Die, { FACE_NAME } from './Die'

const PURPLE = '#b388ff'
const GOLD = '#ffc400'
const WIN = '#69ff47'
const LOSS = '#ff5252'
const GRID = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'

function Empty({ text = 'Keine Daten' }) {
  return (
    <div style={{ color: MUTED, fontSize: 13, padding: '12px 0' }}>{text}</div>
  )
}

// Score-Verlauf über Zeit — Linie mit hervorgehobenem Bestwert
export function ScoreLineChart({ history }) {
  const ys = history.map((h) => h.score)
  if (ys.length === 0) return <Empty />

  const W = 320
  const H = 140
  const pad = { l: 32, r: 10, t: 14, b: 14 }
  let min = Math.min(...ys)
  let max = Math.max(...ys)
  if (min === max) {
    min -= 10
    max += 10
  }
  const nx = Math.max(1, ys.length - 1)
  const sx = (i) => pad.l + (i / nx) * (W - pad.l - pad.r)
  const sy = (y) =>
    pad.t + (1 - (y - min) / (max - min)) * (H - pad.t - pad.b)
  const pts = ys.map((y, i) => `${sx(i)},${sy(y)}`).join(' ')
  const bestIdx = ys.indexOf(Math.max(...ys))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <line x1={pad.l} x2={W - pad.r} y1={sy(max)} y2={sy(max)} stroke={GRID} />
      <line x1={pad.l} x2={W - pad.r} y1={sy(min)} y2={sy(min)} stroke={GRID} />
      <text x={2} y={sy(max) + 3} fill={MUTED} fontSize="9">
        {max}
      </text>
      <text x={2} y={sy(min) + 3} fill={MUTED} fontSize="9">
        {min}
      </text>
      {ys.length > 1 && (
        <polyline
          points={pts}
          fill="none"
          stroke={PURPLE}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {ys.map((y, i) => (
        <circle
          key={i}
          cx={sx(i)}
          cy={sy(y)}
          r={i === bestIdx ? 3.5 : 2.5}
          fill={i === bestIdx ? WIN : PURPLE}
        />
      ))}
    </svg>
  )
}

// Verteilung der Endpunkte — Histogramm mit Schnitt-Markierung
export function Histogram({ scores }) {
  if (!scores.length) return <Empty />

  const bucket = 25
  const start = Math.floor(Math.min(...scores) / bucket) * bucket
  const end = Math.ceil((Math.max(...scores) + 1) / bucket) * bucket
  const buckets = []
  for (let b = start; b < end; b += bucket)
    buckets.push({ from: b, count: 0 })
  scores.forEach((s) => {
    const idx = Math.floor((s - start) / bucket)
    if (buckets[idx]) buckets[idx].count++
  })
  const maxCount = Math.max(...buckets.map((b) => b.count), 1)
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

  const W = 320
  const H = 130
  const pad = { l: 6, r: 6, t: 10, b: 18 }
  const bw = (W - pad.l - pad.r) / buckets.length
  const avgX = pad.l + ((avg - start) / (end - start)) * (W - pad.l - pad.r)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {buckets.map((b, i) => {
        const h = (b.count / maxCount) * (H - pad.t - pad.b)
        const x = pad.l + i * bw
        const y = H - pad.b - h
        return (
          <g key={i}>
            {b.count > 0 && (
              <rect
                x={x + 1}
                y={y}
                width={bw - 2}
                height={h}
                rx="3"
                fill={PURPLE}
              />
            )}
            {i % 2 === 0 && (
              <text
                x={x + bw / 2}
                y={H - 6}
                fill={MUTED}
                fontSize="8"
                textAnchor="middle"
              >
                {b.from}
              </text>
            )}
          </g>
        )
      })}
      <line
        x1={avgX}
        x2={avgX}
        y1={pad.t - 4}
        y2={H - pad.b}
        stroke={WIN}
        strokeWidth="1.5"
        strokeDasharray="3 2"
      />
      <text x={avgX + 3} y={pad.t + 2} fill={WIN} fontSize="9">
        Ø {avg}
      </text>
    </svg>
  )
}

// Form: letzte Ergebnisse als Punkte + aktuelle Serie
export function FormStrip({ form }) {
  if (!form.length) return <Empty text="Noch keine Spiele" />
  const last = form.slice(-12)
  const streak = currentStreak(form)

  return (
    <div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {last.map((w, i) => (
          <span
            key={i}
            title={w ? 'Sieg' : 'Niederlage'}
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: w ? WIN : 'transparent',
              border: w ? 'none' : `2px solid ${LOSS}`,
              display: 'inline-block',
            }}
          />
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
        {streak > 0
          ? `🔥 ${streak} ${streak === 1 ? 'Sieg' : 'Siege'} in Folge`
          : streak < 0
            ? `${-streak} ${streak === -1 ? 'Niederlage' : 'Niederlagen'} in Folge`
            : '—'}
      </div>
    </div>
  )
}

// --- Kategorie-Statistik (nur Normal-Modus) --------------------------------

const CAT_LABEL = {
  0: '⚀ Einser',
  1: '⚁ Zweier',
  2: '⚂ Dreier',
  3: '⚃ Vierer',
  4: '⚄ Fünfer',
  5: '⚅ Sechser',
  7: 'Dreierpasch',
  8: 'Viererpasch',
  9: 'Full House',
  10: 'Kleine Straße',
  11: 'Große Straße',
  12: 'Kniffel',
  13: 'Chance',
}
const CAT_ORDER = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13]

const pct = (x) => `${Math.round((x ?? 0) * 100)}%`
const de1 = (x) => (x ?? 0).toFixed(1).replace('.', ',')

// Kleine vertikale Balken für eine Verteilung: [{ label, value }]
function MiniBars({ bars }) {
  const max = Math.max(...bars.map((b) => b.value), 1)
  return (
    <div
      style={{ display: 'flex', alignItems: 'flex-end', gap: 3, marginTop: 6 }}
    >
      {bars.map((b, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <div
            style={{
              width: '100%',
              height: 24 * (b.value / max),
              minHeight: b.value > 0 ? 2 : 0,
              background: PURPLE,
              borderRadius: 2,
            }}
          />
          <span style={{ color: MUTED, fontSize: 8 }}>{b.label}</span>
        </div>
      ))}
    </div>
  )
}

function sliderBars(values) {
  if (!values.length) return []
  const step = 3
  const lo = Math.floor(Math.min(...values) / step) * step
  const hi = Math.max(...values)
  const bars = []
  for (let b = lo; b <= hi; b += step) bars.push({ label: String(b), value: 0 })
  values.forEach((v) => {
    const idx = Math.floor((v - lo) / step)
    if (bars[idx]) bars[idx].value++
  })
  return bars
}

function CatRow({ label, cat }) {
  let summary
  let chart = null
  if (cat.kind === 'upper') {
    summary = `Ø ${de1(cat.avgCount)}× · gestr. ${pct(cat.strikeRate)}`
    chart = (
      <MiniBars
        bars={cat.dist.map((v, k) => ({ label: String(k), value: v }))}
      />
    )
  } else if (cat.kind === 'slider') {
    summary = `Ø ${Math.round(cat.avg)} · Med ${Math.round(
      cat.median,
    )} · Best ${cat.max} · gestr. ${pct(cat.strikeRate)}`
    const bars = sliderBars(cat.values)
    if (bars.length) chart = <MiniBars bars={bars} />
  } else {
    summary = `${pct(cat.hitRate)} getroffen (${cat.hits}/${cat.count})`
    chart = (
      <div
        style={{
          height: 5,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 3,
          marginTop: 6,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: pct(cat.hitRate),
            height: '100%',
            background: WIN,
          }}
        />
      </div>
    )
  }

  return (
    <div
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <span style={{ color: 'white', fontSize: 14 }}>{label}</span>
        <span style={{ color: MUTED, fontSize: 11, textAlign: 'right' }}>
          {summary}
        </span>
      </div>
      {chart}
    </div>
  )
}

// Kategorie-Statistik eines Spielers: was er je Kategorie einträgt.
export function CategoryStatsView({ stat }) {
  if (!stat || !stat.gamesWithCells)
    return (
      <Empty text="Noch keine Kategorie-Daten — wird ab den nächsten Normal-Spielen gefüllt." />
    )
  const cats = stat.cats
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ color: MUTED, fontSize: 12 }}>
        Aus {stat.gamesWithCells}{' '}
        {stat.gamesWithCells === 1 ? 'Spiel' : 'Spielen'} · Vorbonus in{' '}
        {pct(stat.bonusRate)} der Spiele
      </div>
      {CAT_ORDER.filter((ci) => cats[ci]).map((ci) => (
        <CatRow key={ci} label={CAT_LABEL[ci]} cat={cats[ci]} />
      ))}
    </div>
  )
}

// Head-to-Head: Bilanz gegen jeden Mitspieler
export function HeadToHeadMatrix({ opponents }) {
  const rows = Object.entries(opponents).sort(
    (a, b) => b[1].played - a[1].played,
  )
  if (!rows.length) return <Empty text="Noch keine Gegner" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map(([name, r]) => {
        const even = r.won === r.lost
        const color = even ? 'rgba(255,255,255,0.6)' : r.won > r.lost ? WIN : LOSS
        return (
          <div
            key={name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            <span style={{ color: 'white' }}>{name}</span>
            <span style={{ fontWeight: 'bold', color }}>
              {r.won}–{r.lost}
              <span style={{ color: MUTED, fontWeight: 'normal', fontSize: 12 }}>
                {' '}
                ({r.played})
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

// --- Reihenfolge (nur Normal-Modus, nur Spiele mit gespeichertem `turn`) ----

// Wie eindeutig ist eine Gewohnheit? Nur für die Einordnung im Text.
function verdict(rate) {
  if (rate >= 0.85) return { text: 'feste Gewohnheit', color: WIN }
  if (rate >= 0.65) return { text: 'klare Tendenz', color: PURPLE }
  if (rate >= 0.55) return { text: 'leichte Tendenz', color: MUTED }
  return { text: 'kein Muster', color: MUTED }
}

// Ein Kategorie-Dropdown für den Duell-Check.
function CatSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        flex: 1,
        minWidth: 0,
        background: 'rgba(255,255,255,0.08)',
        color: 'white',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        padding: '7px 8px',
        fontSize: 13,
      }}
    >
      {ORDER_INDICES.map((ci) => (
        <option key={ci} value={ci} style={{ background: '#1e1e1e' }}>
          {CAT_LABEL[ci]}
        </option>
      ))}
    </select>
  )
}

// Reihenfolge-Statistik eines Spielers: wann trägt er was ein, und welche
// Kategorie kommt konsequent vor welcher?
export function OrderStatsView({ stat }) {
  // Voreinstellung ist genau die Streitfrage am Tisch: große vor kleiner Straße.
  const [a, setA] = useState(11)
  const [b, setB] = useState(10)

  if (!stat || !stat.gamesWithOrder)
    return (
      <Empty text="Noch keine Reihenfolge-Daten — wird ab den nächsten Normal-Spielen gefüllt." />
    )

  const duel = pairRate(stat, a, b)
  const habits = strongestHabits(stat, {
    minGames: Math.min(3, stat.gamesWithOrder),
  })
  const v = duel ? verdict(duel.rate) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ color: MUTED, fontSize: 12 }}>
        Aus {stat.gamesWithOrder}{' '}
        {stat.gamesWithOrder === 1 ? 'Spiel' : 'Spielen'} mit erfasster
        Reihenfolge
      </div>

      {/* Duell-Check: kommt A wirklich vor B? */}
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 10,
          padding: 12,
        }}
      >
        <div style={{ color: 'white', fontSize: 13, marginBottom: 8 }}>
          Kommt zuerst?
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CatSelect value={a} onChange={setA} />
          <span style={{ color: MUTED, fontSize: 12, flexShrink: 0 }}>vor</span>
          <CatSelect value={b} onChange={setB} />
        </div>

        {a === b ? (
          <div style={{ color: MUTED, fontSize: 12, marginTop: 10 }}>
            Zwei verschiedene Kategorien wählen.
          </div>
        ) : duel ? (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginTop: 10,
              }}
            >
              <span style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
                {pct(duel.rate)}
              </span>
              <span style={{ color: MUTED, fontSize: 11 }}>
                {duel.before} von {duel.total} Spielen · {v.text}
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 3,
                marginTop: 6,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: pct(duel.rate),
                  height: '100%',
                  background: v.color,
                }}
              />
            </div>
          </>
        ) : (
          <div style={{ color: MUTED, fontSize: 12, marginTop: 10 }}>
            Für dieses Paar gibt es noch keine Daten.
          </div>
        )}
      </div>

      {/* Ø-Position jeder Kategorie auf der 1–13-Achse */}
      <div>
        <div style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>
          Ø Position im Block (früh → spät)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {stat.ranked.map((ci) => (
            <div
              key={ci}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span
                style={{
                  width: 88,
                  flexShrink: 0,
                  color: 'white',
                  fontSize: 12,
                }}
              >
                {CAT_LABEL[ci]}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 3,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: `${((stat.avgTurn[ci] - 1) / 12) * 100}%`,
                    top: -3,
                    marginLeft: -6,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: PURPLE,
                  }}
                />
              </div>
              <span
                style={{
                  width: 26,
                  flexShrink: 0,
                  textAlign: 'right',
                  color: MUTED,
                  fontSize: 11,
                }}
              >
                {de1(stat.avgTurn[ci])}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Die eindeutigsten Muster */}
      {habits.length > 0 && (
        <div>
          <div style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>
            Stärkste Gewohnheiten
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {habits.map((h) => (
              <div
                key={`${h.a}>${h.b}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 8,
                  padding: '7px 10px',
                }}
              >
                <span style={{ color: 'white', fontSize: 12 }}>
                  {CAT_LABEL[h.a]} <span style={{ color: MUTED }}>vor</span>{' '}
                  {CAT_LABEL[h.b]}
                </span>
                <span
                  style={{
                    color: h.rate >= 0.85 ? WIN : PURPLE,
                    fontSize: 12,
                    fontWeight: 'bold',
                    flexShrink: 0,
                  }}
                >
                  {pct(h.rate)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Kniffel-Augenzahlen ---------------------------------------------------

// Welche Augenzahl fällt am häufigsten als Kniffel? Speist sich aus der
// Kniffel-Zeile und aus fünf gleichen Würfeln im oberen Teil.
export function KniffelFaceView({ stat }) {
  if (!stat || !stat.total)
    return (
      <Empty text="Noch keine Kniffel erfasst — erscheint, sobald einer gewürfelt wird." />
    )

  const top = topFace(stat)
  const max = Math.max(...stat.faces, 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3, 4, 5, 6].map((face) => {
        const count = stat.faces[face - 1]
        const isTop = top && face === top.face && count > 0
        return (
          <div
            key={face}
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <Die face={face} size={26} />
            <div
              style={{
                flex: 1,
                height: 10,
                background: 'rgba(255,255,255,0.07)',
                borderRadius: 5,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(count / max) * 100}%`,
                  height: '100%',
                  borderRadius: 5,
                  background: isTop ? GOLD : PURPLE,
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <span
              style={{
                width: 22,
                flexShrink: 0,
                textAlign: 'right',
                fontSize: 13,
                fontWeight: isTop ? 'bold' : 'normal',
                color: isTop ? GOLD : 'rgba(255,255,255,0.75)',
              }}
            >
              {count}
            </span>
          </div>
        )
      })}

      <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
        {stat.total} {stat.total === 1 ? 'Kniffel' : 'Kniffel'}
        {top && ` · ${FACE_NAME[top.face]} führt`}
      </div>

      {stat.unknown > 0 && (
        <div style={{ color: MUTED, fontSize: 11, lineHeight: 1.5 }}>
          Davon {stat.unknown} ohne Angabe der Augenzahl — aus Spielen, bevor sie
          im Modal antippbar war.
        </div>
      )}
    </div>
  )
}
