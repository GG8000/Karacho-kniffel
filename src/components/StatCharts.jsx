import { currentStreak } from '../logic/stats'

const PURPLE = '#b388ff'
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
