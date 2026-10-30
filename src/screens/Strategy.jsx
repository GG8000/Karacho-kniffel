import { useState } from 'react'
import Die from '../components/Die'

// Der Strategie-Tab. Fasst das Video "I Solved Yahtzee*" von Ballpark Figures
// zusammen: einmal als Regelliste zum Nachspielen (EINFACH), einmal mit der
// Rechnung dahinter (MATHE).
//
// Die Regellisten sind die Entscheidungstabellen aus dem Video, auf Prioritäten
// verdichtet: die erste passende Regel gewinnt. Sie gelten für den Spielstart
// mit leerem Block — später entscheidet zusätzlich, welche Felder noch offen sind.

const PURPLE = '#673ab7'
const LIGHT = '#b39ddb'
const MUTED = 'rgba(255,255,255,0.55)'

const VIDEO_URL = 'https://youtu.be/DOgb5wrb7mM'
const POST_URL = 'https://ballparkfigures.substack.com/p/yahtzee'

// Zeilen der beiden Regellisten. dice sind Beispielgruppen — mehrere Gruppen
// stehen für "oder".
const FIRST_ROLL = [
  {
    dice: [[6, 6, 6, 6, 6], [2, 3, 4, 5, 6]],
    text: 'Kniffel oder Große Straße: behalten und eintragen.',
  },
  { dice: [[5, 5, 5, 5]], text: 'Vier gleiche behalten.' },
  { dice: [[4, 4, 4]], text: 'Drei gleiche behalten.' },
  {
    dice: [[2, 3, 4, 5]],
    text: 'Die offene Straße 2-3-4-5 behalten — sie kann beidseitig zur Großen werden.',
  },
  {
    dice: [[5, 5]],
    text: 'Ein Paar aus 3ern, 4ern, 5ern oder 6ern behalten. Bei zwei Paaren nur das höhere.',
  },
  { dice: [[1, 2, 3, 4], [3, 4, 5, 6]], text: 'Die anderen kleinen Straßen behalten.' },
  { dice: [[2, 2]], text: 'Ein Paar Zweier behalten.' },
  { dice: [[3, 4, 5]], text: 'Bei 1-1-3-4-5: nur 3-4-5 behalten.' },
  {
    dice: [[5]],
    text: 'Eine einzelne 4, 5 oder 6 behalten — lieber die 5, dann die 4.',
  },
]

const SECOND_ROLL = [
  {
    dice: [[6, 6, 6, 6, 6], [2, 3, 4, 5, 6]],
    text: 'Kniffel oder Große Straße: eintragen.',
  },
  { dice: [[5, 5, 5, 5]], text: 'Vier gleiche behalten.' },
  {
    dice: [[1, 2, 3, 4]],
    text: 'Kleine Straße: behalten und auf die Große würfeln.',
  },
  {
    dice: [[4, 4, 4]],
    text: 'Drei 4er, 5er oder 6er behalten — auch wenn du ein Full House hättest.',
  },
  { dice: [[2, 2, 2, 6, 6]], text: 'Full House aus kleinen Zahlen: eintragen.' },
  { dice: [[3, 3, 3]], text: 'Alle anderen Drillinge behalten.' },
  {
    dice: [[5, 5]],
    text: 'Ein Paar aus 4ern, 5ern oder 6ern behalten. Bei zwei Paaren das höhere.',
  },
  { dice: [[2, 3, 4], [3, 4, 5]], text: '2-3-4 oder 3-4-5 behalten.' },
  {
    dice: [[3, 3]],
    text: 'Ein Paar 2er oder 3er behalten. Bei 1-1-2-2 und 1-1-3-3 beide Paare, bei 2-2-3-3 nur die 3er.',
  },
  {
    dice: [[3, 4]],
    text: 'Sonderfälle: aus 1-1-3-4-6 die 3-4, aus 1-2-3-5-6 die 2-3-5, aus 1-2-4-5-6 die 4-5-6. Ein Paar Einsen nur, wenn sonst nichts passt.',
  },
]

const NEVER = [
  { dice: [[1, 1]], text: 'Paar Einsen' },
  { dice: [[2, 3, 4]], text: '2-3-4 als Straßenansatz' },
  { dice: [[3, 3, 5, 5]], text: 'Zwei Paare' },
  { dice: [[2, 2, 2, 6, 6]], text: 'Full House im ersten Wurf' },
]

const B = ({ children }) => (
  <b style={{ color: 'white', fontWeight: 'bold' }}>{children}</b>
)

const P = ({ children }) => (
  <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.55 }}>{children}</div>
)

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

function DiceGroups({ groups }) {
  return (
    <div
      style={{
        width: 122,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {groups.map((faces, g) => (
        <div key={g} style={{ display: 'flex', gap: 3 }}>
          {faces.map((face, i) => (
            <Die key={i} size={20} face={face} />
          ))}
        </div>
      ))}
    </div>
  )
}

// Eine Regelzeile: Nummer, Beispielwürfel, Erklärung.
function Rule({ n, dice, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: '50%',
          background: n ? PURPLE : 'rgba(255,255,255,0.12)',
          color: 'white',
          fontSize: 12,
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {n ?? '✕'}
      </div>
      <DiceGroups groups={dice} />
      <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.45 }}>
        {children}
      </div>
    </div>
  )
}

function RuleList({ rules }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rules.map((r, i) => (
        <Rule key={i} n={i + 1} dice={r.dice}>
          {r.text}
        </Rule>
      ))}
    </div>
  )
}

function Practice() {
  return (
    <>
      <Note>
        Die Grundidee in einem Satz: <B>Würfel mit gleicher Augenzahl behalten</B>
        {' '}— nicht Straßen und Full Houses jagen. Gleiche Zahlen füllen die
        meisten Felder.
      </Note>

      <Section title="NACH DEM ERSTEN WURF">
        <P>
          Geh die Liste von oben nach unten durch. <B>Die erste Regel, die
          passt, gilt.</B> Alles andere würfelst du neu. Passt keine Regel,
          würfle alle fünf neu.
        </P>
        <RuleList rules={FIRST_ROLL} />
        <P>
          <B>Nie behalten:</B>
        </P>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {NEVER.map((r, i) => (
            <Rule key={i} dice={r.dice}>
              {r.text}
            </Rule>
          ))}
        </div>
      </Section>

      <Section title="NACH DEM ZWEITEN WURF">
        <P>Gleiches Prinzip, jetzt bleibt nur noch ein Wurf.</P>
        <RuleList rules={SECOND_ROLL} />
      </Section>

      <Section title="WO TRÄGST DU EIN?">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <P>
            <B>Drei oder vier gleiche lieber oben eintragen</B> statt bei
            Dreier- oder Viererpasch. Die oberen Felder sind später schwerer zu
            füllen, der Pasch klappt fast immer irgendwann.
          </P>
          <P>
            <B>Kleine Straße, Große Straße und Chance möglichst lange offen
            lassen.</B> Solange sie frei sind, hat fast jeder Wurf noch einen
            Platz.
          </P>
        </div>
      </Section>

      <Section title="IM ENDSPIEL">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <P>
            Sind nur noch wenige Felder offen, zählt nur noch eins: <B>welche
            Würfel bringen dir im Schnitt die meisten Punkte</B> für genau diese
            Felder?
          </P>
          <P>
            Beim <B>Dreier-/Viererpasch</B> lohnt es sich manchmal, lieber hohe
            Würfel zu behalten als die sicherste Variante. Für die <B>Straßen</B>:
            ohne 3 und 4 im Wurf alles neu würfeln.
          </P>
          <P>
            In dieser App bringt ein <B>zweiter Kniffel</B> keinen Extrabonus.
            Die Videoregeln zum 100-Punkte-Bonus gelten hier nicht.
          </P>
        </div>
      </Section>
    </>
  )
}

function Theory() {
  return (
    <>
      <Note>
        Der Computer hat Kniffel <B>rückwärts</B> durchgerechnet: erst den
        letzten Zug, dann den vorletzten, und so weiter bis zum Anfang. So kennt
        er für jede Lage die beste Entscheidung.
      </Note>

      <Section title="WAS IST EIN SPIELSTAND?">
        <P>
          Ein Spielstand besteht aus: <B>welche Felder sind schon voll</B> und
          <B> wie viele Punkte stehen im oberen Teil</B> (wegen des 63er-Bonus).
          Das Video nennt diese Zahlen:
        </P>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Stat n="≈ 342 Mrd." label="alle denkbaren Spielstände" />
          <Stat n="105.285.166" label="davon erreichbare (ohne das Spielende)" />
          <Stat
            n="536.320"
            label="nötig, wenn man nur Punkte maximiert — die Punkte im unteren Teil ändern nichts mehr an der Zukunft"
          />
        </div>
        <P>
          Mit 536.320 Zuständen ist die Rechnung für einen Computer machbar. Die
          Methode heißt <B>dynamische Programmierung</B>: ein großes Problem in
          kleine zerlegen und jedes Ergebnis nur einmal berechnen.
        </P>
      </Section>

      <Section title="EINE ENTSCHEIDUNG = EIN DURCHSCHNITT">
        <P>
          Für jede Auswahl behaltener Würfel rechnet der Computer aus, wie viele
          Punkte du <B>im Schnitt</B> am Ende bekommst:
        </P>
        <Note>
          Wert = Summe aus (Wahrscheinlichkeit eines Ergebnisses × Punkte, die
          dieses Ergebnis am Ende bringt)
        </Note>
        <P>
          Er nimmt die Auswahl mit dem höchsten Wert. Daher kommen die Regeln
          oben — nichts davon ist Bauchgefühl.
        </P>
        <P>
          <B>Beispiel:</B> Du behältst drei gleiche und hast noch zwei Würfe für
          die zwei übrigen Würfel. Die Chance, mit einem Wurf keinen vierten zu
          treffen, ist 25/36. Mit zwei Würfen also (25/36)² ≈ 48 %. Es klappt
          demnach in <B>ca. 52 %</B> der Fälle: 1 − (25/36)² ≈ 0,52.
        </P>
      </Section>

      <Section title="WARUM GLEICHE ZAHLEN?">
        <P>Die dreizehn Felder lassen sich in vier Gruppen teilen:</P>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Stat n="9" label="Felder wollen gleiche Zahlen: Einser bis Sechser, Dreierpasch, Viererpasch, Kniffel" />
          <Stat n="2" label="Felder wollen verschiedene Zahlen: die beiden Straßen" />
          <Stat n="1" label="Feld dazwischen: Full House" />
          <Stat n="1" label="Feld, dem es egal ist: Chance" />
        </div>
        <P>
          Wer gleiche Zahlen sammelt, bedient also neun von dreizehn Feldern.
          Straßen helfen nur zwei. Das ist der <B>Optionswert</B>: Die Strategie
          bevorzugt, was möglichst viele Felder offen und nützlich hält. Deshalb
          bleiben Straßen und Chance lange frei.
        </P>
      </Section>

      <Section title="OBEN STATT DREIERPASCH">
        <P>
          Hast du im letzten Zug drei oder vier gleiche, ist die Chance, das
          obere Feld noch zu füllen, nur etwa <B>35 %</B>. Beim Dreierpasch sind
          es etwa <B>71 %</B>. Das schwerere Feld füllst du deshalb zuerst.
        </P>
      </Section>

      <Section title="DER ERSTE ZUG">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Stat n="89" label="verschiedene Entscheidungslagen im ersten Zug" />
          <Stat n="32" label="mögliche Ergebnisse am Ende von Zug 1 bei bestem Spiel" />
          <Stat n="6" label="davon erhöhen deinen erwarteten Endstand — zusammen unter 30 % Wahrscheinlichkeit" />
        </div>
        <P>
          Die meisten ersten Züge liegen also <B>unter dem Durchschnitt</B>. Das
          ist normal und kein Fehler. Jeder Würfel im oberen Teil bringt grob das
          <B> Dreifache seiner Augenzahl</B> an Erwartung, die Chance liegt
          zwischen 19 und 26 Punkten.
        </P>
        <P>
          Wer das Video-Rezept spielt, kommt laut Autor auf einen Schnitt von
          etwas über <B>255 Punkten</B> (45 Online-Spiele).
        </P>
      </Section>

      <Section title="UND GEGEN ANDERE SPIELER?">
        <P>
          Das Video löst Kniffel für <B>einen Spieler, der seine Punkte
          maximiert</B>. Gegen Mitspieler ist die beste Strategie
          <B> nicht gelöst</B>: Die Zustände explodieren auf Billiarden.
        </P>
        <P>
          Als Faustregel gilt: Liegst du hinten, spiel <B>riskanter</B> (Kniffel
          und Straßen jagen). Liegst du vorn, spiel <B>sicher</B>.
        </P>
      </Section>
    </>
  )
}

// Eine Kennzahl mit Erklärung.
function Stat({ n, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          minWidth: 88,
          flexShrink: 0,
          color: LIGHT,
          fontSize: 16,
          fontWeight: 'bold',
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'right',
        }}
      >
        {n}
      </div>
      <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.45 }}>{label}</div>
    </div>
  )
}

const linkStyle = { color: LIGHT, textDecoration: 'underline' }

function Credits() {
  return (
    <Section title="QUELLE">
      <P>
        Diese Seite fasst das Video <B>„I Solved Yahtzee*"</B> von{' '}
        <B>Ballpark Figures</B> (Patrick Liscio) in einfachen Worten zusammen.
        Alle Idee und Rechenarbeit stammen von ihm. Die Regellisten folgen den
        Tabellen zum Video. Fehler in der Vereinfachung gehen auf das Konto
        dieser App.
      </P>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <a href={VIDEO_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          ▶ Das Video auf YouTube
        </a>
        <a href={POST_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          📄 Der Artikel mit allen Tabellen (Ballpark Figures)
        </a>
      </div>
    </Section>
  )
}

export default function Strategy({ onBack }) {
  // easy | math
  const [tab, setTab] = useState('easy')

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#1e1e1e',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div className="app-bar">
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: 18,
            cursor: 'pointer',
            padding: '0 8px',
          }}
        >
          ←
        </button>
        🧠 STRATEGIE
        <div style={{ width: 40 }} />
      </div>

      <div style={{ display: 'flex', padding: '10px 16px 0', gap: 8 }}>
        {[
          ['easy', '🎯 Einfach'],
          ['math', '📐 Die Mathe'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              padding: '8px 2px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 'bold',
              background: tab === id ? PURPLE : 'rgba(255,255,255,0.06)',
              color: tab === id ? 'white' : 'rgba(255,255,255,0.5)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 26,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {tab === 'easy' ? <Practice /> : <Theory />}
        <Credits />
      </div>
    </div>
  )
}
