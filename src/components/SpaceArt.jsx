import { useId } from 'react'

// Kleine Weltraum-Illustrationen als Inline-SVG: kein Bild, kein Request, also
// auch offline und in jeder Größe scharf. Der Planet ist "Low Poly": ein
// Raster aus leicht verschobenen Punkten, jedes Dreieck flach gefärbt. Alles
// wird einmal beim Laden berechnet (deterministisch, ohne Zufall), damit der
// Planet bei jedem Render gleich aussieht.

const COLS = 7
const OCEAN = ['#3a7bf0', '#2f6be0', '#4a8cf7', '#2858cf', '#3571e8']
const LAND = ['#3ddc84', '#2fbf6e', '#58e08c', '#27a35c']

// Einfacher, stabiler Pseudo-Zufall aus einer Zahl.
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// "Kontinente" als Ellipsen: (Mitte x, y, Radius x, y)
const CONTINENTS = [
  [38, 42, 19, 14],
  [67, 63, 13, 11],
  [62, 26, 10, 7],
  [26, 70, 8, 6],
]
const isLand = (x, y) =>
  CONTINENTS.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1)

function buildFacets() {
  const step = 100 / (COLS - 1)
  const pts = []
  for (let r = 0; r < COLS; r++) {
    for (let c = 0; c < COLS; c++) {
      // Rand fix lassen, innen verschieben: sonst bleibt die Kugel eckig.
      const edge = r === 0 || c === 0 || r === COLS - 1 || c === COLS - 1
      const j = edge ? 0 : (hash(r * 17 + c) - 0.5) * step * 0.7
      const k = edge ? 0 : (hash(r * 31 + c * 7) - 0.5) * step * 0.7
      pts.push([c * step + j, r * step + k])
    }
  }
  const tris = []
  let i = 0
  for (let r = 0; r < COLS - 1; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      const a = pts[r * COLS + c]
      const b = pts[r * COLS + c + 1]
      const d = pts[(r + 1) * COLS + c]
      const e = pts[(r + 1) * COLS + c + 1]
      for (const t of [[a, b, d], [b, e, d]]) {
        const cx = (t[0][0] + t[1][0] + t[2][0]) / 3
        const cy = (t[0][1] + t[1][1] + t[2][1]) / 3
        const palette = isLand(cx, cy) ? LAND : OCEAN
        tris.push({
          d: `M${t[0]}L${t[1]}L${t[2]}Z`,
          fill: palette[Math.floor(hash(++i) * palette.length)],
        })
      }
    }
  }
  return tris
}
const FACETS = buildFacets()

export function Planet() {
  const id = useId()
  return (
    <svg viewBox="-4 -4 108 108" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`${id}c`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
        {/* Licht von links oben, Schatten rechts unten — gibt die Kugelform. */}
        <radialGradient id={`${id}s`} cx="32%" cy="26%" r="85%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#050a30" stopOpacity="0.6" />
        </radialGradient>
        <radialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
          <stop offset="0.82" stopColor="#4aa8ff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#4aa8ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Atmosphärenschein */}
      <circle cx="50" cy="50" r="58" fill={`url(#${id}g)`} />
      <g clipPath={`url(#${id}c)`}>
        {FACETS.map((f, i) => (
          <path key={i} d={f.d} fill={f.fill} stroke="rgba(255,255,255,0.12)" strokeWidth="0.3" />
        ))}
        <circle cx="50" cy="50" r="50" fill={`url(#${id}s)`} />
      </g>
    </svg>
  )
}

export function Rocket() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {/* Flamme */}
      <path d="M20 36 Q24 50 28 36 Z" fill="#ff9f1c" />
      <path d="M22 36 Q24 44 26 36 Z" fill="#ffe066" />
      {/* Flossen */}
      <path d="M17 26 L10 38 L19 34 Z" fill="#e0405a" />
      <path d="M31 26 L38 38 L29 34 Z" fill="#e0405a" />
      {/* Rumpf */}
      <path d="M24 4 C32 10 33 24 31 36 L17 36 C15 24 16 10 24 4 Z" fill="#fff" />
      <path d="M24 4 C28 7 30 11 30.6 15 L17.4 15 C18 11 20 7 24 4 Z" fill="#e0405a" />
      <circle cx="24" cy="23" r="4" fill="#3ccfff" stroke="#c9d6ff" strokeWidth="1.5" />
    </svg>
  )
}
