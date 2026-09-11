import { useEffect, useState } from 'react'
import { onGuide } from '../lib/guide'
import {
  CATEGORIES,
  FIXED_POINTS,
  formatCell,
  upperValue,
} from '../logic/kniffel'

// Die Anleitung. Erklärt zwei Dinge, die man niemandem ansieht: dass der obere
// Teil eine BALANCE führt statt absoluter Punkte, und wie die Zellen bedient
// werden.
//
// Die Beispielzellen laufen bewusst durch formatCell() aus logic/kniffel.js —
// dieselbe Funktion, die den echten Block beschriftet. Damit kann die Anleitung
// nicht auseinanderlaufen, wenn sich die Darstellung einmal ändert.

const PURPLE = '#673ab7'
const LIGHT = '#b39ddb'
const MUTED = 'rgba(255,255,255,0.55)'

// Aus der Blockpalette in App.css — die Anleitung soll denselben Block zeigen,
// den man gleich vor sich hat.
const BONUS_OK = 'var(--bonus-ok)'
const BONUS_MISS = 'var(--bonus-miss)'
const ARMED = 'var(--armed)'

const FOURS = 3 // Zeilenindex der Vierer — Beispielzeile für den oberen Teil

// Eine Zelle, die aussieht wie im Block.
function Cell({ cIdx, entry, ring = false }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 58,
        height: 38,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--rule)',
        borderRadius: 4,
        background: 'var(--felt)',
        color: 'var(--cream)',
        fontSize: 15,
      }}
    >
      {ring && (
        <span
          style={{
            position: 'absolute',
            inset: 4,
            borderRadius: '50%',
            border: `2px solid var(--kniffel-gold)`,
            boxShadow: `0 0 6px rgba(255,196,0,0.55)`,
          }}
        />
      )}
      {formatCell(cIdx, entry)}
    </div>
  )
}

// Beispielzelle links, Erklärung rechts.
function Row({ cIdx, entry, ring, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Cell cIdx={cIdx} entry={entry} ring={ring} />
      <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.45 }}>
        {children}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          color: LIGHT,
          fontSize: 12,
          fontWeight: 'bold',
          letterSpacing: 2,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

// Hervorgehobener Merksatz.
function Note({ children }) {
  return (
    <div
      style={{
        background: 'rgba(103,58,183,0.18)',
        border: `1px solid ${PURPLE}`,
        borderRadius: 10,
        padding: '11px 13px',
        color: 'white',
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  )
}

const B = ({ children }) => (
  <b style={{ color: 'white', fontWeight: 'bold' }}>{children}</b>
)

export default function Guide() {
  const [open, setOpen] = useState(false)

  useEffect(() => onGuide(() => setOpen(true)), [])

  // Am Handy liegt der Block hinter der Anleitung — ohne das scrollt der
  // Hintergrund mit, sobald die Anleitung selbst am Ende ist.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const upper = (count) => ({ value: upperValue(FOURS, count) })

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#1e1e1e',
        zIndex: 15000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Kopfzeile bleibt stehen, der Rest scrollt darunter weg. */}
      <div
        style={{
          flexShrink: 0,
          height: 50,
          background: PURPLE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px 0 16px',
          color: 'white',
          fontWeight: 'bold',
          letterSpacing: 2,
        }}
      >
        <span>ANLEITUNG</span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Anleitung schließen"
          style={{
            background: 'rgba(0,0,0,0.2)',
            border: 'none',
            color: 'white',
            borderRadius: '50%',
            width: 28,
            height: 28,
            fontSize: 14,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 26,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.55 }}>
          Kniffel läuft hier wie immer — drei Würfe, dreizehn Felder, wer nichts
          Passendes hat, streicht. Anders ist nur, <B>was im oberen Teil in der
          Zelle steht</B>. Das erklärt diese Seite, dazu die Bedienung der
          Tabelle.
        </div>

        <Section title="DER OBERE TEIL ZÄHLT WÜRFEL, NICHT PUNKTE">
          <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.55 }}>
            Auf einem gedruckten Block schreibst du bei den Vierern <B>16</B> für
            vier Vieren. Hier steht stattdessen, <B>wie viele Würfel du mehr oder
            weniger als drei</B> hattest:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row cIdx={FOURS} entry={upper(3)}>
              Genau <B>drei</B> Vieren — das Soll ist erfüllt, deshalb ein
              schlichter Strich.
            </Row>
            <Row cIdx={FOURS} entry={upper(4)}>
              <B>Vier</B> Vieren — einer mehr als das Soll.
            </Row>
            <Row cIdx={FOURS} entry={upper(1)}>
              Nur <B>eine</B> Vier — zwei zu wenig, macht −8.
            </Row>
            <Row cIdx={FOURS} entry={upper(0)}>
              <B>Gestrichen</B>, gar keine Vier. Der schlechteste Fall der Zeile.
            </Row>
          </div>

          <Note>
            Der Trick dahinter: Drei von jeder Zahl sind zusammen genau{' '}
            <B>63 Punkte</B> — die Grenze für den Bonus von 35. Wer überall auf{' '}
            <B>−</B> steht, ist also punktgenau auf Bonuskurs. Plus und Minus
            verrechnen sich dabei: Ein <B>+4</B> gleicht ein <B>−4</B> woanders
            aus. Du musst nie bis 63 rechnen, du musst nur nicht ins Minus
            rutschen.
          </Note>

          <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.55 }}>
            Die Zeile <B>SUMME</B> rechnet für dich zurück auf die gewohnte Zahl.
            Sie leuchtet{' '}
            <span style={{ color: BONUS_OK, fontWeight: 'bold' }}>
              messingfarben
            </span>
            ,
            sobald der Bonus sicher ist, und ist bis dahin{' '}
            <span style={{ color: BONUS_MISS, fontWeight: 'bold' }}>rot</span>.
          </div>
        </Section>

        <Section title="DER UNTERE TEIL IST NORMAL">
          <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.55 }}>
            Hier stehen echte Punkte, wie auf jedem Block.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row cIdx={9} entry={{ value: FIXED_POINTS[9] }}>
              Full House — die Punktzahl der Kategorie.
            </Row>
            <Row cIdx={9} entry={{ value: 0 }}>
              <B>Gestrichen.</B> Unten heißt <B>x</B> gestrichen — oben heißt{' '}
              <B>−</B> dagegen „genau drei". Zwei verschiedene Dinge.
            </Row>
          </div>
        </Section>

        <Section title="SO TRÄGST DU EIN">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.55 }}>
              <B>Oberer Teil (1 bis 6):</B> immer wieder auf dieselbe Zelle
              tippen. Jeder Tap zählt einen Würfel weiter — der erste Tap heißt
              „gestrichen", der sechste „fünf gleiche", der siebte macht die
              Zelle wieder leer. Du tippst dich also einfach bis zu deiner
              Würfelzahl durch.
            </div>
            <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.55 }}>
              <B>{CATEGORIES[9]}, {CATEGORIES[10]}, {CATEGORIES[11]}:</B> fester
              Wert, deshalb reicht Tippen. Erster Tap trägt ein
              ({FIXED_POINTS[9]}/{FIXED_POINTS[10]}/{FIXED_POINTS[11]}), zweiter
              streicht, dritter leert.
            </div>
            <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.55 }}>
              <B>{CATEGORIES[7]}, {CATEGORIES[8]}, {CATEGORIES[13]}:</B> öffnen
              ein Rad. Gewertet wird die <B>Summe aller fünf Würfel</B>, nicht
              nur der passenden — deshalb geht es von 5 bis 30. Streichen geht
              dort über den roten Knopf.
            </div>
            <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.55 }}>
              <B>{CATEGORIES[12]}:</B> tippe an, <B>welche</B> Augenzahl du
              fünfmal hattest. Gibt {FIXED_POINTS[12]} Punkte.
            </div>
          </div>
        </Section>

        <Section title="WENN DU DICH VERTIPPST">
          <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.55 }}>
            Eine <B>leere</B> Zelle reagiert sofort. Eine schon <B>gefüllte</B>{' '}
            wird vom ersten Tap nur markiert — sie bekommt einen{' '}
            <span style={{ color: ARMED, fontWeight: 'bold' }}>
              orangen Rahmen
            </span>
            , und erst der zweite Tap ändert sie wirklich. So kostet ein
            versehentlicher Fingertipper auf eine fertige Zeile nichts.
          </div>
          <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.55 }}>
            Nach jeder Änderung erscheint unten kurz{' '}
            <B>„Rückgängig"</B> — einmal antippen und der alte Wert ist zurück.
          </div>
        </Section>

        <Section title="DER GOLDENE RING">
          <Row cIdx={FOURS} entry={upper(5)} ring>
            Fünf gleiche Würfel. Die App markiert das, egal in welcher Zeile es
            passiert.
          </Row>
          <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.55 }}>
            Der Ring ist nur eine <B>Markierung für die Statistik</B> — gezählt
            wird, wie oft und mit welcher Augenzahl du Kniffel würfelst. Punkte
            bringt immer nur die Kategorie selbst, in die du ihn einträgst.
          </div>
        </Section>

        <Section title="AM ENDE: DIE AUSWERTUNG">
          <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.55 }}>
            Ist der Block voll, führt <B>AUSWERTEN</B> zur Endabrechnung. Dort
            steht neben den Punkten, wie sich dein <B>Rating</B> ändert: eine
            Wertungszahl über alle Spiele hinweg, die bei 1000 startet. Sie
            steigt, wenn du gewinnst, und steigt umso stärker, je stärker deine
            Gegner sind. Gegen dich selbst spielst du sie nicht hoch — sie
            bewegt sich nur, wenn mindestens zwei Leute mitspielen.
          </div>
          <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.55 }}>
            Gespeichert wird erst mit <B>Weiter</B> oder <B>Nochmal</B>. Bis
            dahin kommst du mit <B>Korrektur</B> zurück in den Block.
          </div>
        </Section>

        <button
          className="btn-primary"
          onClick={() => setOpen(false)}
          style={{ alignSelf: 'center', marginTop: 4, marginBottom: 8 }}
        >
          Verstanden
        </button>
      </div>
    </div>
  )
}
