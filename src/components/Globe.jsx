// Drehende Erdkugel (WebGL2, ohne Bibliothek) für Splash und Hauptmenü.
//
// Eine echte Kugel statt Bild-Loop: Der Fragment-Shader (lib/globeShader.js)
// rechnet Beleuchtung, Wolken und Atmosphäre pro Pixel, die Landmasse kommt
// aus einer zur Laufzeit gemalten Textur (lib/globeTexture.js). Ohne WebGL2
// (oder wenn der Kontext nicht entsteht) wird stattdessen der statische
// <Planet /> gezeigt, die App geht also nie kaputt.
//
// Wichtig für iOS Safari: pro Instanz genau EIN Kontext, und beim Unmount
// wird er per WEBGL_lose_context freigegeben — sonst reißt Safari nach ein
// paar Screen-Wechseln alte Kontexte ab und die Seite wird schwarz.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Planet } from './SpaceArt'
import { loadGlobeTexture, pickTextureWidth } from '../lib/globeTexture'
import { VERT, buildFrag } from '../lib/globeShader'

// Durchmesser der Kugel / Kantenlänge des Canvas. Der Rest ist Platz für den
// Atmosphären-Halo. Mittelpunkt der Kugel = Mittelpunkt des Canvas, Radius =
// GLOBE_DISC_RATIO / 2 * Canvasbreite (z. B. um eine Rakete zu platzieren).
export const GLOBE_DISC_RATIO = 0.84

const MAX_BACKING = 640 // Pixel je Seite, egal wie groß/scharf der Bildschirm ist
const MIN_SCALE = 0.5
const SLOW_MS = 24 // mittlere Framezeit, ab der die Auflösung sinkt
const REDUCED_SPEED = 0.15

const DEG = Math.PI / 180
const norm180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180

// Textur früh anstoßen (z. B. beim App-Start), damit sie beim Splash bereit ist.
export function preloadGlobe() {
  return loadGlobeTexture(pickTextureWidth()).catch(() => {})
}

function compile(gl, type, src) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh)
    return null
  }
  return sh
}

// Startet Renderer + Schleife auf dem Canvas. Gibt { destroy, poke } zurück
// oder null, wenn WebGL2 nicht verfügbar ist.
function startGlobe(canvas, wrap, live, state) {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false, // Kante glättet der Shader selbst
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  })
  if (!gl) return null

  let prog = null
  let tex = null
  let loc = {}
  let lost = false
  let dead = false
  let texData = null // { w, h, pixels } sobald gebaut
  let texAt = 0 // Zeitpunkt (ms), an dem die Textur hochgeladen wurde
  let texMix = 0
  let raf = 0
  let last = 0
  let visible = true
  let reduced = false
  let scale = 1
  let accMs = 0
  let accN = 0
  let warm = 0 // Frames, die nach Größen-/Textur-Änderungen nicht gemessen werden
  let cssW = 0
  let px = 0
  let vao = null

  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  reduced = !!mq?.matches
  const onMq = () => { reduced = !!mq.matches }
  mq?.addEventListener?.('change', onMq)

  function initGL() {
    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, buildFrag(GLOBE_DISC_RATIO))
    if (!vs || !fs) return false
    prog = gl.createProgram()
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false
    gl.useProgram(prog)
    if (px) gl.viewport(0, 0, px, px) // nach Context-Restore ist der Viewport zurückgesetzt
    loc = {}
    for (const k of ['uTex', 'uRot', 'uCloudRot', 'uTilt', 'uTexMix', 'uAA', 'uGlow']) {
      loc[k] = gl.getUniformLocation(prog, k)
    }
    // Ein Vollbild-Dreieck ohne Buffer; WebGL2 braucht trotzdem ein VAO-Objekt.
    vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.uniform1i(loc.uTex, 0)

    tex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    // 1x1-Platzhalter, bis die echte Textur fertig ist (nie "unvollständig" binden)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10, 50, 120, 0]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    texMix = 0
    if (texData) uploadTexture()
    return true
  }

  function uploadTexture() {
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false) // Alpha = Stadtlichter, nicht Deckkraft
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, texData.w, texData.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, texData.pixels)
    gl.generateMipmap(gl.TEXTURE_2D) // ohne Mipmaps flimmern Küsten am Rand
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    const an = gl.getExtension('EXT_texture_filter_anisotropic')
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)))
    texAt = performance.now()
    warm = 20
  }

  if (!initGL()) {
    // Kontext hat keine Shader übersetzt: sauber aufgeben statt halb zu laufen.
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return null
  }

  // ---------------------------------------------------------- Größe -------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const want = Math.max(48, Math.round(Math.min(MAX_BACKING, cssW * dpr) * scale))
    if (want === px) return
    px = want
    canvas.width = px
    canvas.height = px
    gl.viewport(0, 0, px, px)
    warm = 20
    // Größenänderung leert den Canvas. Der ResizeObserver feuert NACH den
    // rAF-Callbacks und direkt vor dem Malen: sofort neu zeichnen, sonst
    // blitzt ein Frame lang nichts.
    draw(performance.now())
  }
  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver((entries) => {
        // Nur im Callback messen (kein erzwungenes Layout in der Render-Schleife)
        const w = entries[0].contentRect.width
        if (w && w !== cssW) { cssW = w; resize() }
      })
    : null
  ro?.observe(wrap)
  if (!ro) { cssW = wrap.clientWidth || 240; resize() }

  // ---------------------------------------------------------- Zeichnen ----
  function draw(now) {
    if (lost || dead || !px) return
    // Einblenden der Landmassen nach dem Upload (~0.8 s)
    texMix = texData ? Math.min(1, (now - texAt) / 800) : 0
    gl.uniform1f(loc.uRot, state.lon * DEG)
    gl.uniform1f(loc.uCloudRot, (state.lon + state.cloud) * DEG)
    const t = live.current.tilt * DEG
    gl.uniform2f(loc.uTilt, Math.cos(t), Math.sin(t))
    gl.uniform1f(loc.uTexMix, texMix)
    gl.uniform1f(loc.uAA, (2 / (px * GLOBE_DISC_RATIO)) * 1.15)
    gl.uniform1f(loc.uGlow, live.current.glow ? 1 : 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  function drawOnce() {
    if (!raf) draw(performance.now())
  }

  // Auch im Pause-Zustand weiterlaufen, solange die Landmassen einblenden —
  // sonst bliebe ein pausierter Globe auf der blauen Kugel stehen.
  const fading = () => !!texData && texMix < 1
  const shouldRun = () =>
    !dead && !lost && visible && !document.hidden && (!live.current.paused || fading())

  function frame(now) {
    raf = 0
    if (!shouldRun()) return
    let dt = last ? now - last : 16.7
    last = now
    if (dt > 250) dt = 16.7 // nach Pause/Tab-Wechsel kein Sprung

    if (!live.current.paused) {
      const k = reduced ? REDUCED_SPEED : 1
      const sp = live.current.speed * k
      // Oberfläche bewegt sich von links nach rechts => die Länge in der Mitte
      // wird kleiner (Osten liegt rechts).
      state.lon = norm180(state.lon - (sp * dt) / 1000)
      // Wolken: etwas schneller als der Boden + eigene Grunddrift; bei
      // Reduced Motion gar nicht (sie ziehen dann nur mit dem Boden).
      if (!reduced) state.cloud = (state.cloud - ((live.current.speed * 0.12 + 1.4) * dt) / 1000) % 360
    }

    draw(now)

    // Framezeit mitteln; zu langsam => Auflösung schrittweise senken.
    if (warm > 0) warm--
    else if (dt < 250) {
      accMs += dt
      if (++accN >= 60) {
        if (accMs / accN > SLOW_MS && scale > MIN_SCALE) {
          scale = Math.max(MIN_SCALE, scale - 0.125)
          resize()
        }
        accMs = 0
        accN = 0
      }
    }
    raf = requestAnimationFrame(frame)
  }
  function start() {
    if (raf || !shouldRun()) return
    last = 0
    raf = requestAnimationFrame(frame)
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }
  // Wird vom Component bei Prop-Änderungen (paused) aufgerufen.
  function poke() {
    if (shouldRun()) start()
    else { stop(); drawOnce() }
  }

  // ----------------------------------------------- Sichtbarkeit etc. -----
  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((es) => {
        visible = es[es.length - 1].isIntersecting
        poke()
      })
    : null
  io?.observe(wrap)
  const onVis = () => poke()
  document.addEventListener('visibilitychange', onVis)

  // ----------------------------------------------- Kontextverlust --------
  const onLost = (e) => {
    e.preventDefault() // sonst gibt es nie ein "restored"
    lost = true
    stop()
  }
  const onRestored = () => {
    lost = false
    if (initGL()) { resize(); drawOnce(); poke() }
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  // ----------------------------------------------------- Textur ----------
  loadGlobeTexture(pickTextureWidth()).then((d) => {
    if (dead) return
    texData = d
    if (!lost) { uploadTexture(); drawOnce() }
    poke()
  }).catch(() => { /* ohne Textur bleibt es eine blaue Kugel mit Wolken */ })

  poke()

  return {
    poke,
    destroy() {
      dead = true
      stop()
      ro?.disconnect()
      io?.disconnect()
      mq?.removeEventListener?.('change', onMq)
      document.removeEventListener('visibilitychange', onVis)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      if (!lost) {
        gl.deleteTexture(tex)
        gl.deleteProgram(prog)
        gl.deleteVertexArray(vao)
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

const CANVAS_STYLE = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none'

const Globe = forwardRef(function Globe(
  { size = 240, speed = 14, tilt = 0, startLon = 0, paused = false, glow = true, onTap, label = 'Erde', className, style },
  ref,
) {
  const wrapRef = useRef(null)
  const engine = useRef(null)
  const [fallback, setFallback] = useState(false)

  // Aktuelle Props für die Render-Schleife (kein Neustart bei Änderungen).
  const live = useRef({ speed, tilt, glow, paused })
  live.current.speed = speed
  live.current.tilt = tilt
  live.current.glow = glow
  live.current.paused = paused

  // Zustand überlebt Re-Renders; startLon gilt nur beim ersten Mal.
  const state = useRef(null)
  if (!state.current) state.current = { lon: norm180(startLon), cloud: 0 }

  useImperativeHandle(ref, () => ({
    // Länge (-180..180°), die gerade in der Bildmitte liegt — direkt als
    // startLon für einen nachfolgenden Globe verwendbar.
    getRotation: () => state.current.lon,
  }), [])

  useEffect(() => {
    if (fallback) return undefined
    const wrap = wrapRef.current
    // Canvas von Hand anlegen (statt per JSX): unter StrictMode läuft der Effekt
    // zweimal, und ein Canvas mit per loseContext() beendetem Kontext kann
    // keinen neuen mehr bekommen. Jeder Lauf braucht also ein frisches Element.
    const canvas = document.createElement('canvas')
    canvas.style.cssText = CANVAS_STYLE
    canvas.setAttribute('aria-hidden', 'true')
    wrap.appendChild(canvas)
    let eng = null
    try {
      eng = startGlobe(canvas, wrap, live, state.current)
    } catch {
      eng = null
    }
    if (!eng) {
      canvas.remove()
      setFallback(true)
      return undefined
    }
    engine.current = eng
    return () => {
      eng.destroy()
      engine.current = null
      canvas.remove()
    }
  }, [fallback])

  useEffect(() => { engine.current?.poke() }, [paused])

  const dim = typeof size === 'number' ? `${size}px` : size
  const interactive = typeof onTap === 'function'
  const wrapStyle = {
    position: 'relative',
    display: 'inline-block',
    width: dim,
    height: dim,
    flex: 'none',
    lineHeight: 0,
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    contain: 'layout paint size', // Canvas darf das Layout drumherum nie beeinflussen
    ...(interactive ? { cursor: 'pointer', touchAction: 'manipulation' } : null),
    ...style,
  }
  const a11y = interactive
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': label,
        onClick: onTap,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(e) }
        },
      }
    : { 'aria-hidden': true }

  return (
    <div ref={wrapRef} className={className} style={wrapStyle} {...a11y}>
      {fallback && (
        // Planet füllt seine viewBox zu 100/108 aus; so skalieren, dass die
        // Scheibe dieselbe Größe wie die der WebGL-Kugel hat.
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div className="globe-fallback" style={{ width: `${GLOBE_DISC_RATIO * 108}%`, height: `${GLOBE_DISC_RATIO * 108}%` }}>
            <Planet />
          </div>
        </div>
      )}
    </div>
  )
})

export default Globe
