import { useEffect, useMemo, useState } from 'react'
import { onStrike } from '../lib/strike'

// Vollbild-Animation, wenn irgendwo eine Kategorie gestrichen wird — das
// Gegenstück zur Kniffel-Feier. Wird einmal in main.jsx gemountet und hört
// global auf announceStrike().
//
// Bewusst deutlich kürzer als die Feier: ein Block hat bis zu 13 Kategorien,
// das darf das Eintragen nicht ausbremsen.
const DURATION = 1300
const FADE = 350

const RED = '#ff3b30'
const DARK = '#7f1d1d'
const ASH = 'rgba(255,255,255,0.55)'

export default function StrikeAnimation() {
  const [event, setEvent] = useState(null)
  const [leaving, setLeaving] = useState(false)

  useEffect(
    () =>
      onStrike((detail) => {
        // id erzwingt einen Neustart, wenn zwei Streichungen dicht
        // aufeinanderfolgen (gleiche Idee wie in KniffelCelebration).
        setEvent({ ...detail, id: `${Date.now()}-${Math.random()}` })
        setLeaving(false)
      }),
    [],
  )

  useEffect(() => {
    if (!event) return
    const fade = setTimeout(() => setLeaving(true), DURATION - FADE)
    const done = setTimeout(() => setEvent(null), DURATION)
    return () => {
      clearTimeout(fade)
      clearTimeout(done)
    }
  }, [event])

  // Asche einmal pro Streichung festlegen, damit sie beim Re-Render nicht neu
  // gewürfelt wird.
  const ashes = useMemo(() => {
    const n = 18
    return Array.from({ length: n }, (_, i) => ({
      left: `${6 + Math.random() * 88}%`,
      top: `${28 + Math.random() * 34}%`,
      size: 2 + Math.random() * 4,
      // Asche fällt, statt wie die Kniffel-Funken nach außen zu schießen.
      tx: `${(Math.random() - 0.5) * 90}px`,
      ty: `${90 + Math.random() * 160}px`,
      delay: 120 + Math.random() * 260,
      dur: 700 + Math.random() * 500,
      color: i % 4 === 0 ? RED : ASH,
    }))
  }, [event?.id])

  if (!event) return null

  const subtitle = [event.category, event.playerName]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="strike-overlay" style={{ opacity: leaving ? 0 : 1 }}>
      {/* Dunkelroter Blitz von den Rändern her */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 48%, transparent 28%, rgba(127,29,29,0.55) 72%, rgba(0,0,0,0.75))`,
          animation: 'strikeVignette 620ms ease-out both',
        }}
      />

      {/* Der Strich selbst — quer über den ganzen Schirm gezogen.
          Bewusst ein gedrehter Balken statt einer SVG-Linie: ein auf das
          Fenster gestrecktes viewBox verzerrt das Strichmuster, mit dem die
          Linie gezeichnet würde, und sie zerfällt in Stücke. */}
      <div
        style={{
          position: 'absolute',
          left: '-15%',
          top: '52%',
          width: '130%',
          transform: 'rotate(-26deg)',
          transformOrigin: '0 50%',
        }}
      >
        <div
          style={{
            position: 'relative',
            height: 26,
            transformOrigin: '0 50%',
            animation: 'strikeSlash 420ms cubic-bezier(0.3,0,0.2,1) both',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 13,
              background: DARK,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 7,
              height: 12,
              borderRadius: 6,
              background: RED,
              boxShadow: `0 0 16px ${RED}`,
            }}
          />
        </div>
      </div>

      {/* Asche */}
      {ashes.map((a, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: a.left,
            top: a.top,
            width: a.size,
            height: a.size,
            borderRadius: '50%',
            background: a.color,
            '--tx': a.tx,
            '--ty': a.ty,
            animation: `strikeAsh ${a.dur}ms ease-in ${a.delay}ms both`,
          }}
        />
      ))}

      {/* Schriftzug — stempelt sich von oben auf den Strich. */}
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <div
          style={{
            fontSize: 'min(11vw, 46px)',
            fontWeight: 900,
            letterSpacing: 2,
            color: '#fff',
            textShadow: `0 0 16px ${RED}, 0 0 40px ${DARK}, 0 3px 0 rgba(0,0,0,0.5)`,
            animation: 'strikeStamp 420ms cubic-bezier(0.2,1.4,0.35,1) 120ms both',
          }}
        >
          GESTRICHEN
        </div>
        {subtitle && (
          <div
            style={{
              marginTop: 6,
              fontSize: 'min(4.4vw, 17px)',
              fontWeight: 'bold',
              letterSpacing: 3,
              color: RED,
              animation: 'kniffelSubIn 320ms ease-out 420ms both',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )
}
