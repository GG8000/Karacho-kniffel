// Abgasstrahl des Lade-Würfels auf einem 2D-Canvas.
//
// Der Würfel fliegt auf uns zu, sein Triebwerk sitzt auf der abgewandten Seite:
// Aus Sicht des Betrachters entspringt der Strahl HINTER dem Würfel und zieht sich
// in Flugrichtung rückwärts (Richtung Erdrand), wird in der Perspektive schmaler
// und endet in Rauch. Partikel werden im Bildschirmraum am Heck des Würfels
// erzeugt und bleiben dort, wo sie entstanden sind, während der Würfel weiterfliegt
// -> die Spur folgt von selbst der echten Flugbahn und wird nach hinten schmaler,
// weil dort ein kleinerer Würfel sie erzeugt hat.
//
// Schicht für Schicht: weißglühender Kern -> gelb -> orange -> dunkelrot (additiv,
// 'lighter'), dahinter grau-brauner Rauch (normal gemischt), dazu ein paar Funken,
// die nach hinten schießen. Billig gehalten: ein Pool aus Typed Arrays (keine
// Allokation pro Frame), vorgerenderte Radial-Sprites, drawImage statt Verläufe.

const N = 180 // Partikel gesamt (Feuer, Rauch, Funken)
const FIRE = 0
const SMOKE = 1
const SPARK = 2

// Weicher runder Sprite in einer Farbe (Kern deckend, Rand transparent).
function makeSprite(r, g, b) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`)
  gr.addColorStop(0.35, `rgba(${r},${g},${b},0.55)`)
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`)
  x.fillStyle = gr
  x.fillRect(0, 0, 64, 64)
  return c
}

export function createPlume(canvas, reduced) {
  const g = canvas.getContext('2d')
  // Abkühlung von heiß nach kalt; Fortschritt im Leben des Partikels wählt/mischt
  const heat = [makeSprite(255, 250, 235), makeSprite(255, 214, 90), makeSprite(255, 118, 20), makeSprite(185, 34, 10)]
  const smoke = makeSprite(96, 78, 70)

  const X = new Float32Array(N)
  const Y = new Float32Array(N)
  const VX = new Float32Array(N)
  const VY = new Float32Array(N)
  const AGE = new Float32Array(N)
  const LIFE = new Float32Array(N) // 0 = frei
  const SZ = new Float32Array(N) // Radius bei Geburt (px)
  const KIND = new Uint8Array(N)
  const OFF = new Float32Array(N) // Startwärme: Kern 0 (weiß), Hülle schon gelb/orange

  const fx = reduced ? 0.4 : 1 // Bewegung reduziert: weniger Partikel, kein Flackern
  let head = 0
  let fireAcc = 0
  let smokeAcc = 0
  let sparkAcc = 0
  // Flackern: Wertrauschen, alle 40 ms ein neuer Zielwert (~25 Hz), dazwischen
  // linear überblendet
  let nA = 0
  let nB = 0
  let nT = 0

  function add(kind, x, y, vx, vy, life, size, off = 0) {
    const i = head
    head = (head + 1) % N
    KIND[i] = kind
    X[i] = x
    Y[i] = y
    VX[i] = vx
    VY[i] = vy
    AGE[i] = 0
    LIFE[i] = life
    SZ[i] = size
    OFF[i] = off
  }

  function blit(sprite, x, y, r, a) {
    if (a <= 0.003) return
    g.globalAlpha = a > 1 ? 1 : a
    g.drawImage(sprite, x - r, y - r, r * 2, r * 2)
  }

  return {
    clear() {
      g.clearRect(0, 0, canvas.width, canvas.height)
    },

    // dt in Sekunden; (x, y) = Mitte des Würfels, bs = seine Kantenlänge in px,
    // th = Schub 0..1, spawn = Strahl erzeugen (aus, solange der Würfel hinter der
    // Erde steckt oder schon durch ist).
    frame(dt, x, y, bs, th, spawn) {
      const w = canvas.width
      const h = canvas.height
      g.clearRect(0, 0, w, h)

      nT += dt * 1000
      if (nT >= 40) {
        nT = 0
        nA = nB
        nB = reduced ? 0 : Math.random() * 2 - 1
      }
      const flick = 1 + 0.22 * (nA + (nB - nA) * (nT / 40))
      const inten = 0.55 + 0.45 * th
      const maxR = 0.24 * Math.max(w, h) // Sprites nicht unendlich groß (Füllrate)

      if (spawn) {
        // Heck des Würfels: etwas unterhalb der Mitte, vom Würfel selbst verdeckt
        const rx = x
        const ry = y + 0.1 * bs
        fireAcc += 150 * fx * (0.6 + 0.6 * th) * dt
        while (fireAcc >= 1) {
          fireAcc -= 1
          // Kern (schmal, klein, weißglühend) oder Hülle (breit, gleich gelb-orange)
          const core = Math.random() < 0.3
          const wide = core ? 0.1 : 0.4
          add(FIRE, rx + (Math.random() - 0.5) * wide * bs, ry + Math.random() * 0.1 * bs,
            (Math.random() - 0.5) * (core ? 0.06 : 0.2) * bs, bs * (6 + Math.random() * 3) * flick,
            (reduced ? 0.45 : 0.6) + Math.random() * 0.35, bs * (core ? 0.15 : 0.3) * (0.85 + Math.random() * 0.3),
            core ? 0 : 0.3 + Math.random() * 0.2)
        }
        smokeAcc += 24 * fx * dt
        while (smokeAcc >= 1) {
          smokeAcc -= 1
          add(SMOKE, rx + (Math.random() - 0.5) * 0.3 * bs, ry + 0.3 * bs,
            (Math.random() - 0.5) * 0.3 * bs, bs * (3 + Math.random() * 1.4),
            1.6 + Math.random() * 0.8, bs * (0.2 + Math.random() * 0.1))
        }
        sparkAcc += 14 * fx * dt
        while (sparkAcc >= 1) {
          sparkAcc -= 1
          add(SPARK, rx + (Math.random() - 0.5) * 0.25 * bs, ry,
            (Math.random() - 0.5) * 0.9 * bs, bs * (7 + Math.random() * 4),
            0.45 + Math.random() * 0.4, Math.max(1.2, bs * 0.035))
        }
      }

      const drag = Math.exp(-0.6 * dt)
      const turb = reduced ? 0 : 3 * bs * dt
      // Bewegung für alle lebenden Partikel
      for (let i = 0; i < N; i++) {
        if (AGE[i] >= LIFE[i]) continue
        AGE[i] += dt
        VX[i] = (VX[i] + (Math.random() - 0.5) * turb) * drag
        VY[i] *= drag
        X[i] += VX[i] * dt
        Y[i] += VY[i] * dt
      }

      // 1) Rauch: normal gemischt, liegt unter dem Feuer
      g.globalCompositeOperation = 'source-over'
      for (let i = 0; i < N; i++) {
        if (KIND[i] !== SMOKE || AGE[i] >= LIFE[i]) continue
        const k = AGE[i] / LIFE[i]
        const a = 0.34 * inten * Math.min(1, k * 5) * (1 - k)
        blit(smoke, X[i], Y[i], Math.min(maxR, SZ[i] * (1 + 1.8 * k)), a)
      }
      // 2) Feuer und Funken: additiv, Farbe nach Lebensalter (zwei Sprites überblendet)
      g.globalCompositeOperation = 'lighter'
      for (let i = 0; i < N; i++) {
        if (KIND[i] === SMOKE || AGE[i] >= LIFE[i]) continue
        const k = AGE[i] / LIFE[i]
        if (KIND[i] === SPARK) {
          blit(heat[k < 0.5 ? 0 : 1], X[i], Y[i], Math.min(maxR, SZ[i] * (1.4 - k)), inten * (1 - k))
          continue
        }
        const r = Math.min(maxR, SZ[i] * (1 - 0.7 * k)) // verjüngt sich nach hinten
        const a = 0.75 * inten * Math.min(1, k * 40) * Math.pow(1 - k, 0.85)
        const s = Math.min(1, k * 0.8 + OFF[i]) * 3
        const j = s >= 3 ? 2 : s | 0
        const f = s - j
        blit(heat[j], X[i], Y[i], r, a * (1 - f))
        blit(heat[j + 1], X[i], Y[i], r, a * f)
      }
      // Stoßdiamanten: ein paar helle Perlen auf der Strahlachse direkt hinter dem Würfel
      if (spawn) {
        for (let d = 0; d < 3; d++) {
          const dy = y + bs * (0.95 + 0.35 * d)
          blit(heat[0], x, dy, Math.min(maxR, bs * (0.1 - 0.02 * d)), 0.3 * inten * (1 + 0.5 * (flick - 1)))
        }
      }
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = 1
    },
  }
}
