import { useEffect, useMemo, useState } from 'react'
import { onKniffel } from '../lib/celebrate'
import Die, { FACE_NAME } from './Die'

const DURATION = 2600 // gesamte Feier inkl. Ausblenden
const FADE = 400

const GOLD = '#ffc400'
const PURPLE = '#b388ff'
const WHITE = '#ffffff'
const ORANGE = '#ff6d00'

// Ein Würfel, der ins Bild fliegt. Jeder dreht sich unterschiedlich weit rein
// und kommt leicht versetzt an — sonst wirkt die Reihe wie ein einziger Block.
function FlyingDie({ face, index }) {
  return (
    <div
      style={{
        '--spin': `${(index % 2 ? -1 : 1) * (360 + index * 90)}deg`,
        animation: `kniffelDieIn 620ms cubic-bezier(0.2, 1.4, 0.4, 1) ${index * 75}ms both`,
      }}
    >
      <Die face={face} size="min(15vw, 58px)" glow />
    </div>
  )
}

// Vollbild-Feier, wenn irgendwo ein Kniffel eingetragen wird. Wird einmal in
// main.jsx gemountet und hört global auf celebrateKniffel().
export default function KniffelCelebration() {
  const [event, setEvent] = useState(null)
  const [leaving, setLeaving] = useState(false)

  useEffect(
    () =>
      onKniffel((detail) => {
        // id erzwingt einen Neustart der Animation, wenn direkt hintereinander
        // zwei Kniffel eingetragen werden.
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

  // Funken und die angezeigte Würfelseite einmal pro Feier festlegen, damit sie
  // beim Re-Render nicht neu gewürfelt werden.
  const { sparks, face } = useMemo(() => {
    const n = 36
    return {
      // Die Augenzahl kommt aus dem Modal — im oberen Teil aus der Kategorie,
      // in der Kniffel-Zeile aus dem angetippten Würfel. Der Zufallswert ist
      // nur noch ein Notnagel, falls doch mal keine mitkommt.
      face: event?.face ?? 1 + Math.floor(Math.random() * 6),
      sparks: Array.from({ length: n }, (_, i) => {
        const angle = (i / n) * Math.PI * 2 + Math.random() * 0.45
        const dist = 130 + Math.random() * 230
        return {
          tx: `${Math.cos(angle) * dist}px`,
          ty: `${Math.sin(angle) * dist * 0.85 + 70}px`, // etwas Schwerkraft
          size: 4 + Math.random() * 8,
          delay: Math.random() * 240,
          dur: 950 + Math.random() * 750,
          color: [GOLD, PURPLE, WHITE, ORANGE][i % 4],
        }
      }),
    }
  }, [event?.id, event?.face])

  if (!event) return null

  const subtitle =
    event.kind === 'upper'
      ? `5 × ${FACE_NAME[face]}`
      : `5 × ${FACE_NAME[face]} · +50 Punkte`

  return (
    <div
      className="kniffel-overlay"
      style={{
        opacity: leaving ? 0 : 1,
        animation: `kniffelShake 620ms ease-out both`,
      }}
    >
      {/* Blitz + Abdunklung */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.9), rgba(255,109,0,0.35) 35%, transparent 68%)',
          animation: 'kniffelFlash 480ms ease-out both',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
        }}
      />

      {/* Zwei Druckwellen für Tiefe */}
      {[0, 130].map((delay) => (
        <div
          key={delay}
          style={{
            position: 'absolute',
            left: '50%',
            top: '45%',
            width: 220,
            height: 220,
            borderRadius: '50%',
            border: `7px solid ${delay ? PURPLE : GOLD}`,
            animation: `kniffelRing 900ms ease-out ${delay}ms both`,
          }}
        />
      ))}

      {/* Funken */}
      {sparks.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: '45%',
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: s.color,
            boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
            '--tx': s.tx,
            '--ty': s.ty,
            animation: `kniffelSpark ${s.dur}ms ease-out ${s.delay}ms both`,
          }}
        />
      ))}

      {/* Die fünf gleichen Würfel */}
      <div
        style={{
          display: 'flex',
          gap: 'min(2.4vw, 10px)',
          position: 'relative',
        }}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <FlyingDie key={i} face={face} index={i} />
        ))}
      </div>

      {/* Schriftzug */}
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <div
          style={{
            fontSize: 'min(13vw, 54px)',
            fontWeight: 900,
            color: WHITE,
            textShadow: `0 0 18px ${GOLD}, 0 0 44px ${ORANGE}, 0 4px 0 rgba(0,0,0,0.4)`,
            animation: 'kniffelText 720ms cubic-bezier(0.2, 1.5, 0.35, 1) 340ms both',
          }}
        >
          KNIFFEL!
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 'min(4.6vw, 18px)',
            fontWeight: 'bold',
            letterSpacing: 3,
            color: GOLD,
            animation: 'kniffelSubIn 420ms ease-out 760ms both',
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  )
}
