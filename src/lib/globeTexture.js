// Erzeugt zur Laufzeit die Erd-Textur (equirectangular) für <Globe />.
//
// Es gibt bewusst kein Bild im Bundle: Die Umrisse stecken schon in
// worldLand.js, Farben/Eis/Wüsten/Stadtlichter werden hier daraus gemalt. Das
// spart einen Download und ist offline sofort da.
//
// Ergebnis: RGBA8, Zeile 0 = Nordpol, x = 0 ist bei -180°.
//   RGB = Tag-Farbe (sRGB, ohne Beleuchtung)
//   A   = Stadtlichter für die Nachtseite (0..255)
// Der Shader erkennt Wasser an "Blau überwiegt" (siehe globeShader.js) — damit
// reicht ein einziger Texturzugriff pro Pixel.
//
// Die Arbeit läuft in kleinen Zeitscheiben (siehe run()), damit der Splash
// beim Start nicht ruckelt; das Ergebnis wird pro Größe einmal gecacht und
// vom zweiten Globe (Splash -> Menü) sofort wiederverwendet.

import { WORLD_RINGS } from './worldLand'

// ---------------------------------------------------------------- Zufall ---

// Ganzzahl-Hash -> 0..1. Math.imul statt `*`, damit es auf 32 Bit überläuft
// (wie im Shader) und überall gleich aussieht.
function hash3(x, y, z) {
  let h = Math.imul(x, 1597334673) ^ Math.imul(y, 3812015801) ^ Math.imul(z, 2798796415)
  h = Math.imul(h, 1597334673)
  return (h >>> 8) / 16777216
}

const smooth = (t) => t * t * (3 - 2 * t)
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const mix = (a, b, t) => a + (b - a) * t
const step01 = (e0, e1, v) => smooth(clamp01((v - e0) / (e1 - e0)))

// 3D-Value-Noise. 3D, damit er auf der Kugel nahtlos ist (kein Sprung am
// ±180°-Rand, kein Zusammenlaufen an den Polen).
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz)
  const l = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz)
  const x00 = mix(l(0, 0, 0), l(1, 0, 0), fx)
  const x10 = mix(l(0, 1, 0), l(1, 1, 0), fx)
  const x01 = mix(l(0, 0, 1), l(1, 0, 1), fx)
  const x11 = mix(l(0, 1, 1), l(1, 1, 1), fx)
  return mix(mix(x00, x10, fy), mix(x01, x11, fy), fz)
}

function fbm3(x, y, z, oct) {
  let a = 0.5, s = 0, n = 0
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x, y, z)
    n += a
    x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; z = z * 2.03 + 3.1
    a *= 0.5
  }
  return s / n
}

// ----------------------------------------------------------------- Maske ---

// Land als Graustufen-Maske (0..1, mit Kantenglättung) auf einem 2D-Canvas.
// 'evenodd', damit Löcher (Seen) unabhängig von der Umlaufrichtung stimmen.
function paintLandMask(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  const kx = w / 360, ky = h / 180
  for (const ring of WORLD_RINGS) {
    // Die Daten sind am Antimeridian geteilt, aber nicht überall sauber: Ein paar
    // Umrisse (Fidschi, Tschukotka) springen zwischen +180 und -180 und
    // würden beim Füllen als Streifen quer über die ganze Karte laufen. Solche
    // Umrisse (Spannweite > 180°) rechnen wir auf eine Seite um (negative
    // Längen +360) und zeichnen sie zusätzlich um 360° versetzt: der Teil
    // hinter 180° landet so am linken Kartenrand.
    let lo = 180, hi = -180
    for (let i = 0; i < ring.length; i += 2) { if (ring[i] < lo) lo = ring[i]; if (ring[i] > hi) hi = ring[i] }
    const wrap = hi - lo > 180
    for (const off of wrap ? [0, -360] : [0]) {
      const X = (i) => ((wrap && ring[i] < 0 ? ring[i] + 360 : ring[i]) + 180 + off) * kx
      ctx.moveTo(X(0), (90 - ring[1]) * ky)
      for (let i = 2; i < ring.length; i += 2) ctx.lineTo(X(i), (90 - ring[i + 1]) * ky)
      ctx.closePath()
    }
  }
  ctx.fill('evenodd')
  const px = ctx.getImageData(0, 0, w, h).data
  const out = new Float32Array(w * h)
  for (let i = 0; i < out.length; i++) out[i] = px[i * 4] / 255
  c.width = c.height = 0 // Speicher sofort freigeben (iOS ist da knauserig)
  return out
}

// Box-Blur, horizontal zyklisch (Erde ist rund), vertikal geklemmt. Laufende
// Summe: Kosten hängen nicht vom Radius ab.
function blur(src, w, h, r, passes) {
  let a = src
  let b = new Float32Array(w * h)
  const n = 2 * r + 1
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const row = y * w
      let s = 0
      for (let k = -r; k <= r; k++) s += a[row + ((k + w) % w)]
      for (let x = 0; x < w; x++) {
        b[row + x] = s / n
        s += a[row + ((x + r + 1) % w)] - a[row + ((x - r + w) % w)]
      }
    }
    const t = a === src ? new Float32Array(w * h) : a
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let k = -r; k <= r; k++) s += b[Math.min(h - 1, Math.max(0, k)) * w + x]
      for (let y = 0; y < h; y++) {
        t[y * w + x] = s / n
        s += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x]
      }
    }
    a = t
  }
  return a
}

// ------------------------------------------------------- Landschaft -------

// Regionen als Ellipsen [Länge, Breite, Radius Länge°, Radius Breite°, Stärke].
// Von Hand gesetzt, weil Wüsten/Regenwälder nicht nur an der Breite hängen.
const DRY = [
  [8, 23, 30, 7.5, 1], [26, 25, 12, 6, 1], [47, 24, 12, 8, 1], [57, 31, 8, 5, 0.9],
  [71, 27, 5, 4, 0.8], [95, 41, 18, 5.5, 0.95], [133, -25, 17, 9, 0.95], [22, -24, 7, 6, 0.85],
  [15, -22, 3, 6, 0.9], [-112, 34, 7, 6, 0.85], [-105, 28, 5, 5, 0.8], [-70, -23, 2.5, 7, 1],
  [-69, -44, 5, 7, 0.55], [46, 7, 4, 5, 0.6], [0, 15, 30, 3, 0.55], [60, 40, 9, 5, 0.75],
  [-100, 42, 8, 6, 0.4], [65, 50, 22, 5, 0.4], [-62, -34, 6, 5, 0.25], [-42, -9, 4, 4, 0.45],
]
const WET = [
  [-62, -4, 12, 9], [22, 0, 9, 7], [110, 0, 14, 6], [142, -5, 8, 4], [102, 15, 7, 7],
  [75, 12, 2, 5], [-47, -22, 4, 6], [-85, 12, 5, 5], [90, 24, 6, 3], [-76, 4, 4, 5],
]
const FOREST = [
  [-80, 38, 9, 8], [15, 48, 14, 6], [110, 30, 10, 7], [127, 37, 5, 5], [138, 37, 3, 5],
  [-122, 46, 4, 6], [145, -37, 4, 3], [-72, -40, 3, 5],
]
// Gebirge als Strecken [lng1, lat1, lng2, lat2, Breite°, Schnee 0..1].
const RANGES = [
  [-125, 60, -106, 35, 4, 0.1], [-77, 8, -68, -20, 3.2, 0.3], [-68, -20, -72, -52, 3, 0.3],
  [70, 36, 100, 28, 3.5, 0.9], [5, 46, 15, 47, 1.6, 0.6], [59, 52, 65, 66, 1.6, 0],
  [37, 6, 40, 12, 2, 0], [-84, 34, -72, 44, 1.8, 0], [-8, 31, 8, 35, 1.6, 0],
  [146, -38, 145, -18, 1.6, 0], [6, 60, 20, 69, 1.8, 0.3], [38, 44, 48, 41, 1.2, 0.4],
  [70, 42, 90, 43, 2.2, 0.4], [-150, 62, -140, 60, 3, 0.4],
]

const gauss = (v) => Math.exp(-v * v)
function ellipse(lon, lat, e) {
  let dx = Math.abs(lon - e[0])
  if (dx > 180) dx = 360 - dx
  const ux = dx / e[2], uy = (lat - e[1]) / e[3]
  // Früh raus: weit weg heißt praktisch 0 (spart exp() bei den meisten Texeln)
  if (ux > 3 || uy > 3 || uy < -3) return 0
  return Math.exp(-(ux * ux + uy * uy))
}
function segDist(lon, lat, s) {
  const [x1, y1, x2, y2] = s
  const vx = x2 - x1, vy = y2 - y1
  const t = clamp01(((lon - x1) * vx + (lat - y1) * vy) / (vx * vx + vy * vy))
  const ex = lon - (x1 + vx * t), ey = lat - (y1 + vy * t)
  return Math.sqrt(ex * ex + ey * ey)
}

// Farben (sRGB 0..255)
const C = {
  rain: [20, 70, 34], forest: [38, 88, 42], grass: [96, 122, 62], savanna: [150, 140, 80],
  steppe: [160, 152, 92], sand: [214, 184, 128], red: [190, 136, 90], taiga: [44, 72, 54],
  tundra: [124, 130, 112], ice: [236, 242, 247], rock: [122, 108, 94],
  deep: [6, 26, 72], mid: [12, 54, 122], shelf: [30, 120, 170], sea: [224, 232, 238],
}

// Arbeitsfarbe, die schrittweise überblendet wird. Kein Array pro Texel
// anlegen: bei ~160k Landtexeln würde der Garbage Collector sonst spürbar ruckeln.
const cur = [0, 0, 0]
const setC = (a) => { cur[0] = a[0]; cur[1] = a[1]; cur[2] = a[2] }
const blendC = (b, t) => {
  cur[0] += (b[0] - cur[0]) * t
  cur[1] += (b[1] - cur[1]) * t
  cur[2] += (b[2] - cur[2]) * t
}
const desert = [0, 0, 0]

// Land-Farbe an einer Stelle (Ergebnis in `cur`). dx/dy/dz = Einheitsvektor
// (für nahtloses Rauschen).
function landColor(lon, lat, dx, dy, dz) {
  const al = Math.abs(lat)
  const n1 = fbm3(dx * 3, dy * 3, dz * 3, 3) // großflächig: Vegetation
  const n2 = fbm3(dx * 6 + 5, dy * 6, dz * 6, 3) // mittel: Wüstenfarbe
  const n3 = noise3(dx * 80, dy * 80, dz * 80) // fein: Körnung (knapp über Texelgröße, sonst Klötzchen)

  let dry = Math.exp(-(((al - 27) / 8) ** 2)) * 0.6
  for (const e of DRY) dry = Math.max(dry, ellipse(lon, lat, e) * e[4])
  dry = clamp01(dry + (n1 - 0.5) * 0.45)

  let wet = gauss(al / 13) * 0.55
  for (const e of WET) wet = Math.max(wet, ellipse(lon, lat, e))
  let forest = 0
  for (const e of FOREST) forest = Math.max(forest, ellipse(lon, lat, e))

  // Tropen: Savanne <-> Regenwald, gemäßigt: Gras <-> Wald, dazwischen weich
  const trop0 = C.savanna, trop1 = C.rain
  const tt = clamp01(wet * 1.3 - dry * 0.6)
  const temp = clamp01(forest * 1.2 + step01(0.45, 0.7, n1) * 0.6)
  const kTemp = step01(36, 24, al) // 1 = Tropen
  for (let i = 0; i < 3; i++) {
    const tr = trop0[i] + (trop1[i] - trop0[i]) * tt
    const te = C.grass[i] + (C.forest[i] - C.grass[i]) * temp
    cur[i] = te + (tr - te) * kTemp
  }
  blendC(C.steppe, dry * 0.7)
  const nd = step01(0.35, 0.65, n2)
  for (let i = 0; i < 3; i++) desert[i] = C.sand[i] + (C.red[i] - C.sand[i]) * nd
  blendC(desert, step01(0.38, 0.75, dry))

  // Kalt: Taiga -> Tundra -> Eis
  blendC(C.taiga, step01(48, 58, al) * (1 - dry * 0.5))
  blendC(C.tundra, step01(63, 69, al))

  // Gebirge (+ Schnee)
  let m = 0, snow = 0
  for (const r of RANGES) {
    const k = step01(r[4] * 1.5, 0, segDist(lon, lat, r)) ** 1.5
    if (k > m) { m = k; snow = r[5] }
  }
  m = Math.max(m, ellipse(lon, lat, TIBET) * 0.8)
  blendC(C.rock, m * (0.30 + n3 * 0.35))
  blendC(C.ice, snow * step01(0.55, 0.95, m) * step01(0.35, 0.7, n2))

  // Eisschilde: Grönland, Arktis, Antarktis
  const gr = ellipse(lon, lat, GREENLAND)
  blendC(C.ice, Math.max(step01(71, 78, al), step01(0.35, 0.8, gr), step01(60, 66, -lat)))

  const g = 0.91 + 0.18 * n3
  cur[0] *= g; cur[1] *= g; cur[2] *= g
}
const TIBET = [88, 33, 12, 4.5]
const GREENLAND = [-41, 72.5, 15, 9]

// ------------------------------------------------------- Stadtlichter ------

// [Länge, Breite, Gewicht] — grobe Ballungsräume; Gewicht ~ Helligkeit/Größe.
const CITIES = [
  [-74, 40.7, 1.5], [-77, 38.9, 0.9], [-71, 42.4, 0.8], [-87.6, 41.9, 1.2], [-83, 42.4, 0.7],
  [-118.2, 34, 1.4], [-122.3, 37.8, 0.9], [-122.3, 47.6, 0.6], [-96.8, 32.8, 1], [-95.4, 29.8, 0.9],
  [-80.2, 25.8, 0.9], [-84.4, 33.7, 0.8], [-112, 33.4, 0.6], [-115.1, 36.2, 0.5], [-104.9, 39.7, 0.5],
  [-79.4, 43.7, 0.9], [-73.6, 45.5, 0.7], [-99.1, 19.4, 1.4], [-103.3, 20.7, 0.6], [-100.3, 25.7, 0.6],
  [-90.5, 14.6, 0.4], [-79.5, 9, 0.4], [-74.1, 4.7, 0.8], [-77, -12, 0.8], [-70.7, -33.4, 0.7],
  [-58.4, -34.6, 1.2], [-56.2, -34.9, 0.4], [-46.6, -23.5, 1.5], [-43.2, -22.9, 1.1], [-49.3, -25.4, 0.5],
  [-38.5, -12.9, 0.5], [-51.2, -30, 0.5], [-47.9, -15.8, 0.6], [-66.9, 10.5, 0.7], [-78.5, -0.2, 0.4],
  [-0.1, 51.5, 1.5], [2.3, 48.9, 1.3], [7, 51.4, 1.3], [4.4, 51, 0.9], [13.4, 52.5, 0.9],
  [11.6, 48.1, 0.6], [9.2, 45.5, 1.1], [12.5, 41.9, 0.8], [-3.7, 40.4, 0.9], [2.2, 41.4, 0.8],
  [-9.1, 38.7, 0.5], [23.7, 38, 0.6], [21, 52.2, 0.7], [14.4, 50.1, 0.5], [19, 47.5, 0.5],
  [26.1, 44.4, 0.5], [30.5, 50.4, 0.6], [37.6, 55.8, 1.3], [30.3, 59.9, 0.8], [29, 41, 1.2],
  [32.9, 39.9, 0.6], [-6.3, 53.3, 0.4], [18, 59.3, 0.5], [10.7, 59.9, 0.4], [24.9, 60.2, 0.4],
  [31.2, 30, 1.3], [3.4, 6.5, 1.1], [7.5, 9, 0.4], [-0.2, 5.6, 0.5], [-17.4, 14.7, 0.4],
  [-7.6, 33.6, 0.6], [3, 36.7, 0.5], [10.2, 36.8, 0.4], [13.2, 32.9, 0.3], [15.3, -4.3, 0.8],
  [36.8, -1.3, 0.5], [39.3, -6.8, 0.4], [32.6, 0.3, 0.4], [38.7, 9, 0.4], [28, -26.2, 1.2],
  [18.4, -33.9, 0.6], [31, -29.9, 0.5], [28.3, -15.4, 0.3], [47.5, -18.9, 0.3], [36.8, 36.2, 0.4],
  [44.4, 33.3, 0.7], [51.4, 35.7, 1.1], [46.7, 24.7, 0.9], [39.2, 21.5, 0.5], [55.3, 25.2, 0.6],
  [51.5, 25.3, 0.3], [67, 24.9, 1], [74.3, 31.5, 0.9], [72.9, 19, 1.4], [77.2, 28.6, 1.6],
  [88.4, 22.6, 1.2], [90.4, 23.8, 1.3], [80.3, 13.1, 0.8], [77.6, 13, 0.9], [78.5, 17.4, 0.7],
  [73, 18.5, 0.6], [72.6, 23, 0.6], [80.9, 26.8, 0.7], [85.1, 25.6, 0.6], [79.9, 6.9, 0.3],
  [100.5, 13.8, 1], [106.7, 10.8, 0.9], [105.8, 21, 0.7], [101.7, 3.1, 0.7], [103.8, 1.4, 0.6],
  [106.8, -6.2, 1.5], [112.7, -7.3, 0.8], [107.6, -6.9, 0.7], [121, 14.6, 1.1], [96.1, 16.8, 0.5],
  [116.4, 39.9, 1.5], [117.2, 39.1, 0.9], [121.5, 31.2, 1.6], [120.2, 30.3, 0.9], [118.8, 32.1, 0.9],
  [113.3, 23.1, 1.3], [114.1, 22.5, 1.1], [104, 30.7, 0.9], [106.5, 29.5, 0.8], [114.3, 30.6, 0.9],
  [113.7, 34.7, 0.7], [108.9, 34.3, 0.6], [117, 36.7, 0.7], [123.4, 41.8, 0.7], [126.6, 45.8, 0.5],
  [127, 37.5, 1.5], [129, 35.1, 0.7], [139.7, 35.7, 1.8], [135.5, 34.7, 1.3], [136.9, 35.2, 0.9],
  [130.4, 33.6, 0.6], [141.3, 43.1, 0.5], [121.5, 25, 0.8], [120.3, 22.6, 0.4], [69.3, 41.3, 0.5],
  [76.9, 43.3, 0.4], [74.6, 42.9, 0.3], [49, 40.4, 0.4], [44.8, 41.7, 0.3], [82.9, 55, 0.4],
  [60.6, 56.8, 0.4], [92.9, 56, 0.3], [104.3, 52.3, 0.3], [131.9, 43.1, 0.3], [49.1, 55.8, 0.4],
  [151.2, -33.9, 1.1], [145, -37.8, 1, ], [153, -27.5, 0.7], [115.9, -31.9, 0.6], [138.6, -34.9, 0.5],
  [174.8, -36.8, 0.5], [172.6, -43.5, 0.2], [-157.9, 21.3, 0.3], [-149.9, 61.2, 0.2],
]

function paintCities(lights, mask, w, h) {
  const kx = w / 360, ky = h / 180
  // Kleiner, fester Zufallsgenerator: gleiche Streuung bei jedem Start.
  let seed = 1234567
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const blob = (lon, lat, sig, amp) => {
    const cy = (90 - lat) * ky
    const sy = sig * ky
    const sx = sig * kx / Math.max(0.25, Math.cos((lat * Math.PI) / 180))
    const x0 = Math.floor((lon + 180) * kx - 3 * sx), x1 = Math.ceil((lon + 180) * kx + 3 * sx)
    const y0 = Math.max(0, Math.floor(cy - 3 * sy)), y1 = Math.min(h - 1, Math.ceil(cy + 3 * sy))
    const cx = (lon + 180) * kx
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const xx = ((x % w) + w) % w
        if (mask[y * w + xx] < 0.5) continue // keine Lichter im Meer
        const d = ((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2
        lights[y * w + xx] += amp * Math.exp(-d)
      }
    }
  }
  for (const [lon, lat, wgt] of CITIES) {
    blob(lon, lat, 0.45 + wgt * 0.3, 0.55 + wgt * 0.4)
    // Vororte/Nachbarstädte: schwächere Flecken ringsum
    const n = Math.round(4 + wgt * 5)
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, d = (0.6 + rnd() * 1.8) * (0.7 + wgt * 0.5)
      blob(lon + Math.cos(a) * d, lat + Math.sin(a) * d * 0.8, 0.25 + rnd() * 0.25, 0.25 + rnd() * 0.3)
    }
  }
}

// ------------------------------------------------------------- Aufbau ------

function* build(w, h, out) {
  const mask = paintLandMask(w, h)
  yield
  const narrow = blur(mask, w, h, Math.max(2, Math.round(w / 170)), 2) // ~Schelf
  yield
  const wide = blur(mask, w, h, Math.max(6, Math.round(w / 46)), 2) // ~Nähe zum Kontinent
  yield

  const lights = new Float32Array(w * h)
  paintCities(lights, mask, w, h)
  yield

  // Trig-Tabellen: spart pro Pixel vier sin/cos
  const sinLon = new Float32Array(w), cosLon = new Float32Array(w)
  for (let x = 0; x < w; x++) {
    const lon = ((x + 0.5) / w) * Math.PI * 2 - Math.PI
    sinLon[x] = Math.sin(lon); cosLon[x] = Math.cos(lon)
  }

  for (let y = 0; y < h; y++) {
    const lat = 90 - ((y + 0.5) / h) * 180
    const latR = (lat * Math.PI) / 180
    const cl = Math.cos(latR), sl = Math.sin(latR)
    const al = Math.abs(lat)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const lon = ((x + 0.5) / w) * 360 - 180
      const dx = cl * sinLon[x], dy = sl, dz = cl * cosLon[x]

      // Antarktis fehlt in den 110m-Umrissen: als Eisfläche mit unruhiger
      // Küste (Halbinsel bei ~-62°) dazumalen.
      let a = mask[i]
      if (lat < -60) {
        const edge = -68.5 + (fbm3(dx * 4, dy * 4, dz * 4, 3) - 0.5) * 12 - ellipse(lon, lat, [-62, -72, 7, 9]) * 8
        const k = step01(edge + 1.2, edge - 1.2, lat)
        a = Math.max(a, k)
      }

      // Ozean
      const near = narrow[i], far = wide[i]
      setC(C.deep)
      blendC(C.mid, step01(0.02, 0.45, far))
      blendC(C.shelf, step01(0.04, 0.40, near) * 0.75)
      let r = cur[0], g = cur[1], b = cur[2]
      if (al > 58) {
        // Meereis: Rand fransig durch Rauschen, im Süden weiter nördlich
        const nz = fbm3(dx * 5 + 3, dy * 5, dz * 5, 3)
        const lim = lat > 0 ? 76 : 63
        const ic = step01(lim, lim + 6, al + (nz - 0.5) * 16) * 0.95
        r = mix(r, C.sea[0], ic); g = mix(g, C.sea[1], ic); b = mix(b, C.sea[2], ic)
      }

      if (a > 0.004) {
        landColor(lon, lat, dx, dy, dz)
        r = mix(r, cur[0], a); g = mix(g, cur[1], a); b = mix(b, cur[2], a)
      }

      const o = i * 4
      out[o] = r
      out[o + 1] = g
      out[o + 2] = b
      // Lichter mit Körnung: einzelne Punkte statt Matsch
      const sp = hash3(x, y, 7)
      const l = lights[i] > 0 ? Math.min(1, lights[i]) * (0.35 + 1.1 * sp * sp) : 0
      out[o + 3] = Math.min(255, l * 255)
    }
    if (y % 2) yield
  }
  return out
}

// Zeitscheiben: ~8 ms am Stück, dann dem Browser Luft lassen.
function run(gen) {
  return new Promise((resolve, reject) => {
    const step = () => {
      try {
        const t = performance.now()
        do {
          const r = gen.next()
          if (r.done) return resolve(r.value)
        } while (performance.now() - t < 8)
        setTimeout(step, 0)
      } catch (e) {
        reject(e)
      }
    }
    step()
  })
}

const cache = new Map()

// Liefert { w, h, pixels: Uint8Array(w*h*4) }; pro Breite nur einmal gebaut.
export function loadGlobeTexture(w = 1024) {
  if (!cache.has(w)) {
    const h = w / 2
    // Clamped: beim Schreiben wird auf 0..255 begrenzt statt umzubrechen (die
    // Körnung kann Farben knapp über 255 schieben). Hochgeladen wird die
    // Uint8Array-Sicht auf denselben Speicher.
    const clamped = new Uint8ClampedArray(w * h * 4)
    const p = run(build(w, h, clamped)).then(() => ({ w, h, pixels: new Uint8Array(clamped.buffer) }))
    p.catch(() => cache.delete(w)) // nächster Versuch darf neu bauen
    cache.set(w, p)
  }
  return cache.get(w)
}

// Wählt die Texturbreite: schwache Geräte bekommen die halbe Auflösung.
export function pickTextureWidth() {
  const nav = typeof navigator !== 'undefined' ? navigator : {}
  const weak = (nav.deviceMemory && nav.deviceMemory <= 2) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2)
  return weak ? 512 : 1024
}
