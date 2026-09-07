// Erzeugt src/lib/worldLand.js — die Länderumrisse für die Städte-Karte.
//
//   node scripts/build-world.mjs
//
// Quelle ist world-atlas (Natural Earth 110m, public domain), eine reine
// devDependency: zur Laufzeit wird nichts nachgeladen, im Bundle landet nur die
// erzeugte Datei. Die PWA soll offline funktionieren, Kartenkacheln von einem
// fremden Server kämen dafür ohnehin nicht in Frage — und würden die IP jedes
// Spielers dorthin tragen, was dem Ansatz in sql/city_stats.sql widerspricht.
//
// Die Karte ist maximal ein paar hundert Pixel breit. Entsprechend grob darf
// vereinfacht werden; die Konstanten unten sind der ganze Hebel für die Größe.

import { readFileSync, writeFileSync } from 'node:fs'
import { feature } from 'topojson-client'

const SOURCE = new URL(
  '../node_modules/world-atlas/countries-110m.json',
  import.meta.url,
)
const TARGET = new URL('../src/lib/worldLand.js', import.meta.url)

const TOLERANCE = 0.35 // Douglas-Peucker, in Grad
const DECIMALS = 1 // 0.1° ≈ 11 km — bei der Kartengröße rund ein Pixel
const MIN_POINTS = 4 // darunter ist es kein Umriss mehr
const MIN_EXTENT = 1.2 // Grad; wirft Kleinstinseln raus
const MIN_LAT = -60 // Antarktis weg: in Mercator nur ein Balken unten

// Douglas-Peucker über den senkrechten Abstand zur Sehne.
function simplify(points, tolerance) {
  if (points.length < 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]

  while (stack.length) {
    const [first, last] = stack.pop()
    let index = -1
    let maxDist = tolerance
    const [x1, y1] = points[first]
    const [x2, y2] = points[last]
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy)

    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i]
      // Bei Sehnenlänge 0 (geschlossener Ring) zählt der reine Abstand.
      const dist =
        len === 0
          ? Math.hypot(px - x1, py - y1)
          : Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / len
      if (dist > maxDist) {
        index = i
        maxDist = dist
      }
    }

    if (index !== -1) {
      stack.push([first, index], [index, last])
      keep[index] = 1
    }
  }
  return points.filter((_, i) => keep[i])
}

const round = (n) => Number(n.toFixed(DECIMALS))

function usableRing(ring) {
  const lats = ring.map((p) => p[1])
  const lngs = ring.map((p) => p[0])
  if (Math.max(...lats) < MIN_LAT) return false
  const spanX = Math.max(...lngs) - Math.min(...lngs)
  const spanY = Math.max(...lats) - Math.min(...lats)
  return Math.max(spanX, spanY) >= MIN_EXTENT
}

const topo = JSON.parse(readFileSync(SOURCE, 'utf8'))
const { features } = feature(topo, topo.objects.countries)

const rings = []
for (const f of features) {
  const polygons =
    f.geometry.type === 'Polygon'
      ? [f.geometry.coordinates]
      : f.geometry.type === 'MultiPolygon'
        ? f.geometry.coordinates
        : []
  for (const polygon of polygons) {
    // Nur der äußere Ring — Löcher (Lesotho, Kaspisches Meer) fallen bei
    // dieser Auflösung und dieser Flächenfarbe nicht auf.
    const [outer] = polygon
    if (!outer || !usableRing(outer)) continue

    const simplified = simplify(outer, TOLERANCE)
    const flat = []
    let lastX = null
    let lastY = null
    for (const [lng, lat] of simplified) {
      const x = round(lng)
      const y = round(lat)
      if (x === lastX && y === lastY) continue // Duplikate nach dem Runden
      flat.push(x, y)
      lastX = x
      lastY = y
    }
    if (flat.length / 2 >= MIN_POINTS) rings.push(flat)
  }
}

const points = rings.reduce((sum, r) => sum + r.length / 2, 0)
const body = rings.map((r) => `  [${r.join(',')}],`).join('\n')

writeFileSync(
  TARGET,
  `// ERZEUGT von scripts/build-world.mjs — nicht von Hand ändern.
// Quelle: world-atlas / Natural Earth 110m (public domain), vereinfacht auf
// Toleranz ${TOLERANCE}° und ${DECIMALS} Nachkommastelle.
//
// Ein Eintrag = ein geschlossener Umriss, flach als [lng, lat, lng, lat, …].
// Flach, weil das als Quelltext gut die Hälfte gegenüber verschachtelten Paaren
// spart. ${rings.length} Umrisse, ${points} Punkte.

export const WORLD_RINGS = [
${body}
]
`,
  'utf8',
)

console.log(`${rings.length} Umrisse, ${points} Punkte -> src/lib/worldLand.js`)
