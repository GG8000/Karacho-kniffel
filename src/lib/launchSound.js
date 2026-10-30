// Ton für die Lade-Animation (Würfel-Rakete startet, fliegt auf den Spieler zu,
// "rauscht vorbei", dann erscheint der Titel).
//
// Alles wird zur Laufzeit mit der Web Audio API SYNTHETISIERT: keine Audiodateien,
// also keine Urheberrechtsfragen und keine zusätzlichen Bytes im Offline-Precache.
//
// Ebenen: (1) Triebwerk = gefiltertes Rauschen + Sub-Grollen + Flackern/Knistern,
// (2) kurzes Lydisch-C-Motiv (steigendes Arpeggio + Pad) mit Delay/Hall, das sich
// mit dem Flug aufbaut und beim Titel in einem hellen Akkord + Glitzern aufgeht,
// (3) Vorbeiflug = Whoosh mit Doppler-Abfall + tiefer Impact, passend zum Screen-Shake.

const KEY = 'kniffel.sound'

// ---------- Stumm-Einstellung -------------------------------------------------
// Fehlt der Schlüssel, ist der Ton an. try/catch, weil localStorage im
// Privatmodus oder bei gesperrten Cookies werfen kann.
export function isSoundMuted() {
  try { return localStorage.getItem(KEY) === 'off' } catch { return false }
}
export function setSoundMuted(muted) {
  try {
    if (muted) localStorage.setItem(KEY, 'off')
    else localStorage.removeItem(KEY)
  } catch { /* egal: dann gilt die Einstellung nur bis zum Reload nicht */ }
}

// ---------- kleine Helfer -----------------------------------------------------
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)

// Deterministischer Zufall: Offline-Test und echtes Abspielen klingen identisch,
// und es gibt keine Math.random()-Überraschungen beim Debuggen.
function makeRng(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

// Rauschpuffer (weiß oder rosa). Rosa (Paul Kellet) klingt als Triebwerk
// runder/grollender als weißes Rauschen.
function makeNoise(ctx, seconds, pink) {
  const rng = makeRng(pink ? 7 : 13)
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < len; i++) {
    const w = rng() * 2 - 1
    if (!pink) { d[i] = w; continue }
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
    b6 = w * 0.115926
  }
  // Loop-Naht entschärfen: kurzer Crossfade Ende -> Anfang, sonst knackt es
  // alle `seconds` Sekunden hörbar.
  const x = Math.min(512, len >> 2)
  for (let i = 0; i < x; i++) {
    const f = i / x
    d[len - x + i] = d[len - x + i] * (1 - f) + d[i] * f
  }
  return buf
}

// Synthetischer Hall (Impulsantwort aus abklingendem, nach hinten dunkler
// werdendem Stereo-Rauschen). ~1,8 s reichen für "Weltraum", ohne zu matschen.
function makeImpulse(ctx, seconds = 1.8) {
  const rng = makeRng(99)
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  const pre = Math.floor(ctx.sampleRate * 0.012)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let lp = 0
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / ctx.sampleRate
      const env = Math.exp(-t * 3.6)
      // Einpol-Tiefpass, der mit der Zeit zumacht -> Höhen klingen zuerst ab
      const a = Math.min(0.92, 0.25 + t * 0.5)
      lp = lp * a + (rng() * 2 - 1) * (1 - a)
      d[i] = lp * env * 1.6
    }
  }
  return buf
}

// Weiche Begrenzerkurve: unter 0,7 linear, darüber sanft Richtung 0,95. Die
// Kompression davor macht die Arbeit, das hier ist nur der Sicherheitsgurt
// gegen Übersteuern auf billigen Handy-Lautsprechern.
function softClipCurve() {
  const n = 2048
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    const a = Math.abs(x)
    const y = a < 0.7 ? a : 0.7 + 0.25 * Math.tanh((a - 0.7) / 0.25)
    c[i] = Math.sign(x) * y
  }
  return c
}

// ---------- der eigentliche Klang-Graph --------------------------------------
// Baut den kompletten Soundtrack auf JEDEM BaseAudioContext (live oder Offline,
// so lässt er sich im Test rendern). Alle Zeiten sind "Soundtrack-Zeit" in
// Sekunden ab Animationsstart; `skip` ist der Teil, der schon vorbei ist (wenn
// der Ton erst nach einer Geste freigeschaltet wird), `base` die ctx-Zeit, an
// der die Soundtrack-Zeit `skip` erklingen soll.
export function buildLaunchGraph(ctx, opts = {}) {
  const {
    duration = 4000,
    passAt = 0.62,
    skip = 0,
    base = 0,
    destination = ctx.destination,
    level = 0.65, // Master-Pegel
    layers = null, // nur für Tests: z.B. ['engine'] rendert eine Ebene solo
  } = opts

  const D = duration / 1000
  const P = Math.max(0.9, D * passAt) // Vorbeiflug
  const R = P + 0.2 // Titel-Reveal: kurz nach dem Impact, wenn der Shake abklingt
  // Ende: Akkord ist bei R+1,75 aus, danach nur noch Hall. Mindestens ~0,6 s
  // Ausklang nach der Animation, damit ein Hall-Rest nicht abgeschnitten wird.
  const END = Math.max(D + 0.6, R + 2.3)
  const on = (name) => !layers || layers.includes(name)

  const at = (t) => base + Math.max(t, skip) - skip
  const alive = (tEnd) => tEnd > skip + 0.005
  const srcs = [] // alles, was gestoppt werden muss
  const nodes = [] // alles, was getrennt werden muss
  const track = (n) => (nodes.push(n), n)

  // Automation: Punkte [t, wert, 'e'?]. 'e' = exponentielle Rampe zu diesem
  // Punkt. Liegt `skip` mitten in einer Rampe, wird der Zwischenwert selbst
  // berechnet, denn setValueAtTime mit negativer Zeit wirft einen RangeError.
  function curve(param, pts) {
    const last = pts[pts.length - 1]
    const ex = (p) => p[2] === 'e'
    if (last[0] <= skip) { param.setValueAtTime(last[1], at(skip)); return }
    let k = pts.findIndex((p) => p[0] > skip)
    if (k === 0) {
      param.setValueAtTime(pts[0][1], at(skip))
      if (pts[0][0] > skip) param.setValueAtTime(pts[0][1], at(pts[0][0]))
      k = 1
    } else {
      const a = pts[k - 1], b = pts[k]
      const f = (skip - a[0]) / (b[0] - a[0])
      const v = ex(b)
        ? Math.max(a[1], 1e-4) * Math.pow(Math.max(b[1], 1e-4) / Math.max(a[1], 1e-4), f)
        : a[1] + (b[1] - a[1]) * f
      param.setValueAtTime(v, at(skip))
    }
    for (let j = k; j < pts.length; j++) {
      const p = pts[j]
      if (ex(p)) param.exponentialRampToValueAtTime(Math.max(p[1], 1e-4), at(p[0]))
      else param.linearRampToValueAtTime(p[1], at(p[0]))
    }
  }

  const gainNode = (v = 1) => { const g = track(ctx.createGain()); g.gain.value = v; return g }
  const filter = (type, freq, q = 0.7) => {
    const f = track(ctx.createBiquadFilter())
    f.type = type
    f.Q.value = q
    if (typeof freq === 'number') f.frequency.value = freq
    else curve(f.frequency, freq)
    return f
  }
  const connect = (...chain) => { for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]) }

  function osc(type, freq, t1, t2, detune = 0) {
    if (!alive(t2)) return null
    const o = track(ctx.createOscillator())
    o.type = type
    if (typeof freq === 'number') o.frequency.value = freq
    else curve(o.frequency, freq)
    o.detune.value = detune
    o.start(at(t1))
    o.stop(at(t2) + 0.02)
    srcs.push(o)
    return o
  }
  function noise(buf, t1, t2, off = 0) {
    if (!alive(t2)) return null
    const s = track(ctx.createBufferSource())
    s.buffer = buf
    s.loop = true
    s.start(at(t1), off % buf.duration)
    s.stop(at(t2) + 0.02)
    srcs.push(s)
    return s
  }

  // --- Master-Kette: Bus -> Highpass -> Kompressor -> Soft-Clip -> Master -----
  // Der Highpass (25 Hz) nimmt DC und Infraschall weg, der nur Lautsprecher-Hub
  // kostet. Master sitzt zuletzt, damit sich der Fade sauber über alles legt.
  const bus = gainNode(1)
  const hp = filter('highpass', 25, 0.7)
  const comp = track(ctx.createDynamicsCompressor())
  comp.threshold.value = -16
  comp.knee.value = 10
  comp.ratio.value = 5
  comp.attack.value = 0.004
  comp.release.value = 0.18
  const clip = track(ctx.createWaveShaper())
  clip.curve = softClipCurve()
  const master = gainNode(0)
  connect(bus, hp, comp, clip, master)
  master.connect(destination)
  // Kurzes Einblenden (40 ms) gegen Knacken; Ausblenden vor dem Ende.
  curve(master.gain, [[0, 0], [0.04, level], [END - 0.5, level], [END - 0.05, 0]])
  // Beim Einsteigen mitten im Stück (nach Gestenfreigabe) startet die Kurve
  // bei `skip` direkt mit Pegel -> deshalb dort noch einmal sauber einblenden.
  if (skip > 0.04) {
    master.gain.cancelScheduledValues(0)
    master.gain.setValueAtTime(0, at(skip))
    master.gain.linearRampToValueAtTime(level, at(skip) + 0.04)
    if (END - 0.5 > skip + 0.04) master.gain.setValueAtTime(level, at(END - 0.5))
    master.gain.linearRampToValueAtTime(0, at(END - 0.05))
  }

  // --- Hall + Delay -----------------------------------------------------------
  const verbIn = gainNode(1)
  const verb = track(ctx.createConvolver())
  verb.buffer = makeImpulse(ctx)
  const verbOut = gainNode(0.7)
  connect(verbIn, verb, verbOut, bus)

  const STEP = 0.125 // 16tel bei 120 BPM
  const musicBus = gainNode(1)
  const delay = track(ctx.createDelay(1))
  delay.delayTime.value = STEP * 2 // punktierte Achtel würden bei kurzem Stück zu sehr verschmieren
  const fb = gainNode(0.36)
  const fbLp = filter('lowpass', 2600)
  const delayOut = gainNode(0.38)
  const musicDry = gainNode(0.9)
  const musicVerb = gainNode(0.4)
  musicBus.connect(musicDry); musicDry.connect(bus)
  musicBus.connect(delay); delay.connect(fbLp); fbLp.connect(fb); fb.connect(delay)
  fbLp.connect(delayOut); delayOut.connect(bus); delayOut.connect(verbIn)
  musicBus.connect(musicVerb); musicVerb.connect(verbIn)

  const whiteBuf = makeNoise(ctx, 2, false)
  const pinkBuf = makeNoise(ctx, 2, true)
  const rng = makeRng(2024)

  // =============== 1) TRIEBWERK ===============
  // Rosa Rauschen -> Bandpass, dessen Mitte mit der Annäherung hochwandert
  // (tiefes Grollen -> helles Zischen). Nach dem Vorbeiflug fällt der Filter
  // wieder (Doppler), und die Lautstärke verschwindet.
  if (on('engine')) {
    const n = noise(pinkBuf, 0, P + 1.0, 0.3)
    if (n) {
      const bp = filter('bandpass', [[0, 220], [P - 0.05, 2600, 'e'], [P + 0.9, 260, 'e']], 0.8)
      const lp = filter('lowpass', 5200, 0.5)
      // Flackern: zwei langsame LFOs modulieren den Pegel (Brennkammer-Unruhe)
      const flutter = gainNode(1)
      for (const [hz, depth] of [[11, 0.22], [3.3, 0.14]]) {
        const lfo = osc('sine', hz, 0, P + 1.0)
        const d = gainNode(depth)
        if (lfo) { lfo.connect(d); d.connect(flutter.gain) }
      }
      const g = gainNode(0)
      curve(g.gain, [
        [0, 0], [0.12, 0.16], [0.5, 0.2], [P - 0.15, 0.78, 'e'], [P, 0.95], [P + 0.9, 0.0001, 'e'],
      ])
      connect(n, bp, lp, flutter, g, bus)
      const send = gainNode(0.3)
      g.connect(send); send.connect(verbIn)
    }
    // Sub-Grollen: Sägezahn durch Tiefpass, Tonhöhe steigt leicht an
    const sub = osc('sawtooth', [[0, 38], [P, 66, 'e'], [P + 0.5, 30, 'e']], 0, P + 0.6)
    if (sub) {
      const slp = filter('lowpass', 150, 0.7)
      const g = gainNode(0)
      curve(g.gain, [[0, 0], [0.2, 0.12], [P - 0.1, 0.34, 'e'], [P + 0.5, 0.0001, 'e']])
      connect(sub, slp, g, bus)
    }
    // Knistern: kurze helle Rauschimpulse, zum Vorbeiflug hin dichter und lauter
    const cr = noise(whiteBuf, 0, P, 1.1)
    if (cr) {
      const hpf = filter('highpass', 3200, 0.7)
      const g = gainNode(0)
      const pts = [[0, 0]]
      let t = 0.15
      while (t < P - 0.02) {
        const amp = 0.05 + 0.2 * Math.pow(t / P, 1.5)
        pts.push([t, 0], [t + 0.002, amp], [t + 0.012, 0])
        t += (0.12 - 0.09 * (t / P)) * (0.5 + rng())
      }
      pts.sort((a, b) => a[0] - b[0])
      // doppelte Zeitpunkte vermeiden (sonst ungültige Rampen)
      const clean = [pts[0]]
      for (const p of pts.slice(1)) if (p[0] > clean[clean.length - 1][0]) clean.push(p)
      clean.push([P, 0])
      curve(g.gain, clean)
      connect(cr, hpf, g, bus)
    }
  }

  // =============== 2) MUSIK ===============
  // Pad: leere Quinte + None (C, G, D), schwillt mit dem Flug an, Filter geht auf.
  if (on('pad')) {
    const padLp = filter('lowpass', [[0, 260], [P - 0.1, 2600, 'e'], [P + 0.1, 400, 'e']], 0.8)
    const padG = gainNode(0)
    curve(padG.gain, [[0, 0], [0.3, 0.015], [P - 0.15, 0.12, 'e'], [P - 0.02, 0.13], [P + 0.12, 0]])
    connect(padLp, padG, musicBus)
    for (const m of [48, 55, 62]) {
      for (const dt of [-8, 8]) {
        const o = osc('sawtooth', mtof(m), 0, P + 0.15, dt)
        if (o) o.connect(padLp)
      }
    }
  }

  // Arpeggio: Viertonfiguren in steigender Lage, Akkordfolge rückwärts vom
  // Spannungsakkord D-Dur (lydische II) berechnet, damit sie genau vor dem
  // Impact endet und der Reveal nach C "auflöst".
  if (on('arp')) {
    const CH = {
      C: [0, [0, 4, 7, 12]], Am: [9, [0, 3, 7, 12]], F: [5, [0, 4, 7, 12]],
      G: [7, [0, 4, 7, 12]], D: [2, [0, 4, 7, 12]],
    }
    const prog = ['D', 'G', 'F', 'Am', 'C'] // rückwärts ab dem Ende
    const t0 = 0.3
    const lastT = P - STEP
    let N = Math.floor((lastT - t0) / STEP) + 1
    N = Math.max(0, N - (N % 4))
    const arpLp = filter('lowpass', [[0, 700], [P, 6500, 'e']], 1.2)
    connect(arpLp, musicBus)
    for (let i = 0; i < N; i++) {
      const tn = lastT - (N - 1 - i) * STEP
      const fromEnd = Math.floor((N - 1 - i) / 4)
      const [root, iv] = CH[prog[fromEnd % prog.length]]
      const rank = Math.floor(i / 4)
      const lift = 12 * Math.min(1, Math.floor(rank / 2)) + (rank >= 3 ? 12 : 0)
      const midi = 48 + root + iv[i % 4] + lift
      const prog01 = i / Math.max(1, N - 1)
      const a = 0.09 + 0.26 * Math.pow(prog01, 1.3)
      const g = gainNode(0)
      curve(g.gain, [[tn, 0], [tn + 0.004, a], [tn + 0.32, 0.0001, 'e']])
      connect(g, arpLp)
      for (const [type, mul, dt] of [['sawtooth', 1, -6], ['triangle', 2, 5]]) {
        const o = osc(type, mtof(midi) * mul, tn, tn + 0.34, dt)
        if (o) o.connect(g)
      }
    }
  }

  // Reveal: heller C-Dur-Akkord mit lydischer #11 (F#), leicht gestrichen, plus
  // Bass und aufsteigendes Glitzern in C-Lydisch.
  if (on('reveal')) {
    const notes = [48, 55, 60, 64, 67, 71, 74, 78]
    const rLp = filter('lowpass', [[R, 7000], [R + 1.6, 1800, 'e']], 0.8)
    connect(rLp, musicBus)
    notes.forEach((m, i) => {
      const tn = R + i * 0.018
      const a = 0.14 - i * 0.005
      const g = gainNode(0)
      curve(g.gain, [[tn, 0], [tn + 0.008, a], [tn + 0.2, a * 0.7], [tn + 1.7, 0.0001, 'e']])
      connect(g, rLp)
      for (const [type, mul, dt] of [['sawtooth', 1, -7], ['sawtooth', 1, 7], ['triangle', 2, 0]]) {
        const o = osc(type, mtof(m) * mul, tn, tn + 1.75, dt)
        if (o) o.connect(g)
      }
    })
    // Bass-Sinus unter dem Akkord
    const bass = osc('sine', mtof(36), R, R + 1.5)
    if (bass) {
      const g = gainNode(0)
      curve(g.gain, [[R, 0], [R + 0.015, 0.24], [R + 1.5, 0.0001, 'e']])
      connect(bass, g, bus)
    }
    // Glitzern: Sinus-Pings die lydische Tonleiter hinauf, stark im Hall
    const LYD = [0, 2, 4, 6, 7, 9, 11]
    const sparkSend = gainNode(0.9)
    sparkSend.connect(musicBus)
    for (let k = 0; k < 12; k++) {
      const tn = R + 0.04 + k * 0.048 + rng() * 0.01
      const m = 84 + LYD[k % 7] + 12 * Math.floor(k / 7)
      const g = gainNode(0)
      curve(g.gain, [[tn, 0], [tn + 0.004, 0.05 + 0.02 * (k % 2)], [tn + 0.45, 0.0001, 'e']])
      const o = osc('sine', mtof(m), tn, tn + 0.5)
      if (o) connect(o, g, sparkSend)
    }
  }

  // =============== 3) VORBEIFLUG ===============
  if (on('pass')) {
    // Whoosh: Rauschen mit Bandpass, der erst steigt, dann nach dem Vorbeiflug
    // schnell abfällt (Doppler). Lautstärke: lange Anstiegsrampe, kurzer Abfall.
    const w = noise(whiteBuf, P - 0.55, P + 0.8, 0.5)
    if (w) {
      const bp = filter('bandpass', [[P - 0.55, 450], [P - 0.03, 4800, 'e'], [P + 0.04, 3200, 'e'], [P + 0.75, 260, 'e']], 1.3)
      const g = gainNode(0)
      curve(g.gain, [[P - 0.55, 0], [P - 0.03, 0.8], [P + 0.04, 0.7], [P + 0.75, 0.0001, 'e']])
      connect(w, bp, g, bus)
      g.connect(verbIn)
    }
    // Doppler-"Düsenton": Sägezahn, dessen Tonhöhe steigt und dann abfällt
    const j = osc('sawtooth', [[P - 0.5, 600], [P - 0.03, 1500, 'e'], [P + 0.06, 1050, 'e'], [P + 0.7, 320, 'e']], P - 0.5, P + 0.75)
    if (j) {
      const bp = filter('bandpass', [[P - 0.5, 700], [P - 0.03, 2000, 'e'], [P + 0.7, 400, 'e']], 2)
      const g = gainNode(0)
      curve(g.gain, [[P - 0.5, 0], [P - 0.03, 0.1], [P + 0.7, 0.0001, 'e']])
      connect(j, bp, g, bus)
    }
    // Impact: Sinus mit fallender Tonhöhe + Rauschstoß + kurzer Mittenanteil
    const boom = osc('sine', [[P, 120], [P + 0.7, 34, 'e']], P, P + 1.4)
    if (boom) {
      const g = gainNode(0)
      curve(g.gain, [[P, 0], [P + 0.008, 0.95], [P + 0.2, 0.55, 'e'], [P + 1.35, 0.0001, 'e']])
      const send = gainNode(0.35)
      connect(boom, g, bus)
      g.connect(send); send.connect(verbIn)
    }
    const th = noise(pinkBuf, P, P + 0.5, 0.9)
    if (th) {
      const lp = filter('lowpass', [[P, 900], [P + 0.4, 140, 'e']], 0.7)
      const g = gainNode(0)
      curve(g.gain, [[P, 0], [P + 0.006, 0.8], [P + 0.45, 0.0001, 'e']])
      connect(th, lp, g, bus)
      g.connect(verbIn)
    }
    const body = osc('triangle', [[P, 190], [P + 0.3, 52, 'e']], P, P + 0.4)
    if (body) {
      const g = gainNode(0)
      curve(g.gain, [[P, 0], [P + 0.006, 0.35], [P + 0.35, 0.0001, 'e']])
      connect(body, g, bus)
    }
  }

  return {
    master,
    passTime: P,
    revealTime: R,
    end: END, // Soundtrack-Zeit, an der alles still ist
    // Sofort ausblenden (stop()). cancelScheduledValues + aktueller Wert, weil
    // cancelAndHoldAtTime nicht überall existiert.
    fadeOut(ms) {
      const t = ctx.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.setValueAtTime(master.gain.value, t)
      master.gain.linearRampToValueAtTime(0, t + Math.max(0.02, ms / 1000))
    },
    dispose() {
      for (const s of srcs) { try { s.stop() } catch { /* war schon gestoppt */ } }
      for (const n of nodes) { try { n.disconnect() } catch { /* egal */ } }
      try { master.disconnect() } catch { /* egal */ }
    },
  }
}

// ---------- Player mit Autoplay-/Gesten-Logik --------------------------------
const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']

// Die letzten beiden Parameter von `_test` sind nur für den Browser-Test
// (Fake-Context, Fake-Uhr); im App-Code nicht verwenden.
export function createLaunchSound({ duration = 4000, passAt = 0.62, _test = {} } = {}) {
  const nowMs = _test.now || (() => performance.now())
  const makeCtx = _test.createContext || (() => {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) throw new Error('no WebAudio')
    try { return new AC({ latencyHint: 'interactive' }) } catch { return new AC() }
  })

  // true, wenn schon eine Geste da war oder der Browser das nicht verrät (iOS 15).
  const hasActivation = () => _test.createContext || !navigator.userActivation || navigator.userActivation.hasBeenActive

  let state = 'idle' // 'idle' | 'playing' | 'blocked' | 'done'
  let ctx = null
  let graph = null
  let t0 = 0
  let timer = null
  let stopping = false

  const addListeners = () => GESTURES.forEach((e) => window.addEventListener(e, unlock, { capture: true, passive: true }))
  const removeListeners = () => GESTURES.forEach((e) => window.removeEventListener(e, unlock, { capture: true }))

  function finish() {
    clearTimeout(timer)
    removeListeners()
    try { ctx && ctx.removeEventListener && ctx.removeEventListener('statechange', onState) } catch { /* egal */ }
    if (graph) { try { graph.dispose() } catch { /* egal */ } graph = null }
    // close() gibt die Audio-Hardware frei -> kein Akku-Verbrauch im Menü
    if (ctx) { try { const p = ctx.close(); p && p.catch && p.catch(() => {}) } catch { /* egal */ } }
    ctx = null
    state = 'done'
  }

  // Ab hier läuft der Ton. `elapsed` = so viel der Animation ist schon vorbei;
  // der Graph wird um diese Zeit versetzt gebaut, damit Ton und Bild synchron
  // bleiben, auch wenn die Freischaltung erst nach einer Geste kam.
  function begin() {
    if (state !== 'blocked' || !ctx) return
    removeListeners()
    const elapsed = (nowMs() - t0) / 1000
    try {
      const g = buildLaunchGraph(ctx, {
        duration, passAt, skip: Math.max(0, elapsed), base: ctx.currentTime + 0.02,
      })
      if (elapsed >= g.end - 0.3) { g.dispose(); finish(); return }
      graph = g
      state = 'playing'
      timer = setTimeout(finish, Math.max(0, g.end - elapsed) * 1000 + 150)
    } catch {
      finish()
    }
  }

  function onState() { if (ctx && ctx.state === 'running') begin() }

  function tryResume() {
    try {
      const p = ctx.resume()
      if (p && p.then) p.then(() => { if (ctx && ctx.state === 'running') begin() }, () => {})
    } catch { /* bleibt blockiert */ }
  }

  // Läuft IM Gesten-Handler: iOS erlaubt resume() nur synchron aus einer
  // Nutzergeste. Ein lautloser 1-Sample-Puffer hilft älteren iOS-Versionen
  // beim Entsperren.
  function unlock() {
    if (state !== 'blocked') return
    if (!ctx) {
      // Noch kein Kontext (siehe start()): erst jetzt, in einer echten Geste.
      if (!hasActivation()) return
      try { ctx = makeCtx() } catch { finish(); return }
      try { ctx.addEventListener('statechange', onState) } catch { /* egal */ }
    }
    try {
      const s = ctx.createBufferSource()
      s.buffer = ctx.createBuffer(1, 1, 22050)
      s.connect(ctx.destination)
      s.start(0)
    } catch { /* egal */ }
    tryResume()
  }

  const api = {
    get state() { return state },
    isMuted: isSoundMuted,
    setMuted(m) {
      setSoundMuted(!!m)
      if (m) api.stop(80)
    },
    start() {
      if (state !== 'idle' || isSoundMuted()) return
      t0 = nowMs()
      state = 'blocked'
      // Der Kontext entsteht sofort: Wo der Browser Autoplay erlaubt (z.B. eine
      // installierte PWA in Chrome), läuft die Musik dann ohne Tippen los. Chrome
      // loggt dafür ohne Geste "AudioContext was not allowed to start" — nur eine
      // Konsolenwarnung, und das ist es wert.
      try { ctx = makeCtx() } catch { state = 'done'; return }
      if (ctx.state === 'running') { begin(); return }
      // Kontext suspended (kein Nutzerkontakt bisher): nicht werfen, auf Geste warten.
      try { ctx.addEventListener('statechange', onState) } catch { /* egal */ }
      addListeners()
      tryResume() // klappt z.B. in Chrome, wenn die Seite schon "Engagement" hat
    },
    // Der Vorbeiflug ist über `passAt` bereits sample-genau im Graph eingeplant.
    // Ein nachträglicher Aufruf kann ihn nicht mehr verschieben und ist daher
    // absichtlich ein No-op (er bliebe sonst doppelt zu hören).
    passBy() {},
    stop(fadeMs = 200) {
      if (state === 'done' || stopping) return
      if (state === 'playing' && graph) {
        stopping = true
        try { graph.fadeOut(fadeMs) } catch { /* egal */ }
        clearTimeout(timer)
        timer = setTimeout(() => { stopping = false; finish() }, fadeMs + 60)
      } else if (state !== 'idle') {
        finish()
      }
    },
  }
  return api
}
