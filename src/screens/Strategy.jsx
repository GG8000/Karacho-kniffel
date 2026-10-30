import { useState } from 'react'
import Die, { FACE_NAME } from '../components/Die'
import {
  advise,
  ruleMask,
  FIRST_ROLL,
  SECOND_ROLL,
  NEVER,
} from '../logic/strategyAdvisor'

// Der Strategie-Tab. Fasst das Video "I Solved Yahtzee*" von Ballpark Figures
// zusammen. Aufbau, damit er sich ohne Vorwissen erschließt:
//   1. Kurzfassung in drei Sätzen (reicht für 80 % der Fälle)
//   2. Würfel-Helfer zum Ausprobieren (das "Aha": Würfel eingeben, sehen was bleibt)
//   3. Aufklappbare Abschnitte mit den Regeln, Tipps und der Mathe dahinter
//
// Die Regeln selbst stehen in logic/strategyAdvisor.js. Dieselben Daten treiben
// die Listen und den Helfer an, damit beides nie auseinanderläuft.

const VIDEO_URL = 'https://youtu.be/DOgb5wrb7mM'
const POST_URL = 'https://ballparkfigures.substack.com/p/yahtzee'

// --- Würfelreihen ------------------------------------------------------------

// Ein Würfel mit Zustand. mode: 'keep' = goldener Ring (behalten),
// 'skip' = abgedunkelt (neu würfeln), 'avoid' = rosa Ring (nie behalten).
// Das Aussehen steckt in der CSS-Klasse, damit prefers-reduced-motion die
// Übergänge abschalten kann.
function StateDie({ face, size = 30, mode }) {
  return (
    <span className={`strat-die ${mode ?? ''}`}>
      <Die face={face} size={size} />
    </span>
  )
}

// Fünf (oder weniger) Würfel eines Beispiels. keep: Boolean je Würfel.
function DiceRow({ dice, keep, avoid = false, size = 30 }) {
  return (
    <span className="strat-dice-row">
      {dice.map((f, i) => (
        <StateDie
          key={i}
          face={f}
          size={size}
          mode={avoid ? 'avoid' : keep ? (keep[i] ? 'keep' : 'skip') : undefined}
        />
      ))}
    </span>
  )
}

const joinFaces = (dice, keep) =>
  dice.filter((_, i) => keep[i]).join('-')

// --- Aufklapper ----------------------------------------------------------------

function Chevron() {
  return (
    <svg className="strat-chev" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M5 7.5l5 5 5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Der Inhalt bleibt im DOM (für die Höhen-Animation), ist aber zugeklappt per
// visibility:hidden auch nicht fokussierbar oder vorlesbar.
function Accordion({ id, title, hint, open, onToggle, children }) {
  return (
    <section className={`glass-card strat-acc ${open ? 'open' : ''}`}>
      <h2 className="strat-acc-h">
        <button
          type="button"
          className="strat-acc-head"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={onToggle}
        >
          <span className="strat-acc-title">
            {title}
            {hint && <span className="strat-acc-hint">{hint}</span>}
          </span>
          <Chevron />
        </button>
      </h2>
      <div className="strat-acc-body" id={`${id}-body`} role="region" aria-label={title}>
        <div className="strat-acc-inner">
          <div className="strat-acc-content">{children}</div>
        </div>
      </div>
    </section>
  )
}

// --- Regellisten ---------------------------------------------------------------

function Legend() {
  return (
    <div className="strat-legend" aria-hidden="true">
      <span>
        <StateDie face={5} size={30} mode="keep" /> behalten
      </span>
      <span>
        <StateDie face={2} size={30} mode="skip" /> neu würfeln
      </span>
    </div>
  )
}

function RuleList({ rules }) {
  return (
    <ol className="strat-rules">
      {rules.map((r, i) => (
        <li key={i} className="strat-rule">
          <span className="strat-badge" aria-label={`Regel ${i + 1}`}>
            {i + 1}
          </span>
          <div className="strat-rule-body">
            <div className="strat-rule-title">{r.title}</div>
            <div className="strat-rule-text">{r.text}</div>
            <div className="strat-ex">
              {r.examples.map((ex, k) => {
                const keep = ruleMask(r, ex)
                const caption =
                  r.action === 'score' ? 'eintragen' : `behalte ${joinFaces(ex, keep)}`
                return (
                  <div
                    key={k}
                    className="strat-ex-row"
                    role="img"
                    aria-label={`Beispiel ${ex.join(', ')}: ${caption}`}
                  >
                    <DiceRow dice={ex} keep={r.action === 'score' ? null : keep} />
                    <span className="strat-ex-cap">{caption}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

// Der Kern der Bedienung in EINEM Satz plus Mini-Bild der Prioritätsliste.
function PriorityHint({ children }) {
  return (
    <div className="strat-prio">
      <div className="strat-prio-art" aria-hidden="true">
        <i /> <i /> <i />
        <b>↓</b>
      </div>
      <div>{children}</div>
    </div>
  )
}

// --- Würfel-Helfer -------------------------------------------------------------

const START_DICE = [3, 3, 4, 6, 1]

function Helper() {
  const [dice, setDice] = useState(START_DICE)
  const [roll, setRoll] = useState(1)
  const [sel, setSel] = useState(0)

  const res = advise(dice, roll)
  const keptCount = res.keep.filter(Boolean).length
  const total = (roll === 1 ? FIRST_ROLL : SECOND_ROLL).length

  const setFace = (f) => {
    setDice((d) => d.map((x, i) => (i === sel ? f : x)))
    // Gleich zum nächsten Würfel weiter: fünf Würfel in fünf Tipps eingeben.
    setSel((s) => Math.min(s + 1, 4))
  }
  const randomize = () => {
    setDice(Array.from({ length: 5 }, () => 1 + Math.floor(Math.random() * 6)))
    setSel(0)
  }

  let pill
  if (res.action === 'score') pill = 'Eintragen'
  else if (res.action === 'rerollAll') pill = 'Alles neu würfeln'
  else pill = `Behalte ${joinFaces(dice, res.keep)}`

  return (
    <section className="glass-card strat-helper" id="strat-helper" aria-labelledby="strat-helper-h">
      <h2 className="strat-h2" id="strat-helper-h">
        Würfel-Helfer
      </h2>
      <p className="strat-lead">
        Stell deinen Wurf nach: Tippe einen Würfel an, dann seine Augenzahl.
      </p>

      <div className="strat-seg" role="group" aria-label="Welcher Wurf?">
        {[1, 2].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={roll === n}
            className={roll === n ? 'on' : ''}
            onClick={() => setRoll(n)}
          >
            Nach dem {n}. Wurf
          </button>
        ))}
      </div>

      <div className="strat-hdice">
        {dice.map((f, i) => {
          const kept = res.keep[i]
          return (
            <button
              key={i}
              type="button"
              className={`strat-hd ${sel === i ? 'sel' : ''}`}
              onClick={() => setSel(i)}
              aria-pressed={sel === i}
              aria-label={`Würfel ${i + 1}: ${FACE_NAME[f]}, ${kept ? 'behalten' : 'neu würfeln'}`}
            >
              <StateDie face={f} size="min(12.5vw, 52px)" mode={kept ? 'keep' : 'skip'} />
              <span className={`strat-hd-label ${kept ? 'keep' : ''}`}>{kept ? 'bleibt' : 'neu'}</span>
            </button>
          )
        })}
      </div>

      <div className="strat-faces" role="group" aria-label={`Augenzahl für Würfel ${sel + 1}`}>
        {[1, 2, 3, 4, 5, 6].map((f) => (
          <button
            key={f}
            type="button"
            className={dice[sel] === f ? 'on' : ''}
            aria-pressed={dice[sel] === f}
            aria-label={FACE_NAME[f]}
            onClick={() => setFace(f)}
          >
            <Die face={f} size={30} />
          </button>
        ))}
      </div>

      <div className="strat-result" aria-live="polite">
        <div className="strat-result-top">
          <span className={`strat-pill ${res.action}`}>{pill}</span>
          {res.ruleIndex >= 0 && (
            <span className="strat-result-rule">
              Regel {res.ruleIndex + 1} von {total}
            </span>
          )}
        </div>
        <div className="strat-result-title">{res.title}</div>
        <div className="strat-result-text">
          {res.text}
          {res.action === 'keep' && keptCount < 5 && ' Die übrigen würfelst du neu.'}
        </div>
      </div>

      <button type="button" className="btn-outline strat-random" onClick={randomize}>
        Zufälliger Wurf
      </button>

      <p className="strat-fine">
        Gilt für den Spielstart mit leerem Block. Später zählt auch, was noch offen ist.
      </p>
    </section>
  )
}

// --- Mathe ---------------------------------------------------------------------

function Stat({ n, children }) {
  return (
    <div className="strat-stat">
      <div className="strat-stat-n">{n}</div>
      <div>{children}</div>
    </div>
  )
}

function Theory() {
  return (
    <>
      <p>
        Ein Computer hat Kniffel komplett durchgerechnet, und zwar <b>rückwärts</b>: erst den
        letzten Zug, dann den vorletzten, und so weiter bis zum Anfang. So kennt er für jede Lage
        die beste Entscheidung. Die Regeln oben sind also kein Bauchgefühl.
      </p>

      <h3 className="strat-h3">Begriffe in einem Satz</h3>
      <dl className="strat-gloss">
        <dt>Spielstand</dt>
        <dd>Welche Felder schon voll sind und wie viele Punkte im oberen Teil stehen (wegen des 63er-Bonus).</dd>
        <dt>Erwartungswert</dt>
        <dd>
          Die Punkte, die du im Schnitt am Ende bekommst. Gerechnet wird: Wahrscheinlichkeit
          eines Ergebnisses mal seine Punkte, alles zusammengezählt. Der Computer nimmt die
          Auswahl mit dem höchsten Wert.
        </dd>
        <dt>Rückwärts rechnen</dt>
        <dd>
          Ein großes Problem in kleine zerlegen und jedes Ergebnis nur einmal ausrechnen (die
          Fachleute sagen dazu „dynamische Programmierung“).
        </dd>
        <dt>Felder offen halten</dt>
        <dd>Die Strategie bevorzugt, was möglichst viele Felder frei und nützlich hält.</dd>
      </dl>

      <h3 className="strat-h3">Wie groß ist die Rechnung?</h3>
      <Stat n="≈ 342 Mrd.">alle denkbaren Spielstände</Stat>
      <Stat n="105.285.166">davon erreichbare (ohne das Spielende)</Stat>
      <Stat n="536.320">
        reichen, wenn man nur Punkte maximiert: die Punkte im unteren Teil ändern nichts mehr an
        der Zukunft
      </Stat>
      <p>Mit 536.320 Zuständen schafft das ein Computer.</p>

      <h3 className="strat-h3">Beispiel: der vierte Gleiche</h3>
      <p>
        Du behältst drei gleiche und hast noch zwei Würfe für die zwei übrigen Würfel. Die Chance,
        mit einem Wurf keinen vierten zu treffen, ist 25/36. Mit zwei Würfen also (25/36)² ≈
        48 %. Es klappt demnach in <b>ca. 52 %</b> der Fälle: 1 − (25/36)² ≈ 0,52.
      </p>

      <h3 className="strat-h3">Warum gleiche Zahlen?</h3>
      <Stat n="9">
        Felder wollen gleiche Zahlen: Einser bis Sechser, Dreierpasch, Viererpasch, Kniffel
      </Stat>
      <Stat n="2">Felder wollen verschiedene Zahlen: die beiden Straßen</Stat>
      <Stat n="1">Feld dazwischen: Full House</Stat>
      <Stat n="1">Feld, dem es egal ist: Chance</Stat>
      <p>
        Wer gleiche Zahlen sammelt, bedient neun von dreizehn Feldern. Straßen helfen nur zwei.
        Deshalb bleiben Straßen und Chance lange frei.
      </p>

      <h3 className="strat-h3">Oben statt Dreierpasch</h3>
      <p>
        Hast du nur noch einen Zug übrig, klappt ein oberes Feld (zum Beispiel drei Fünfer) nur
        zu etwa <b>35 %</b>, ein Dreierpasch zu etwa <b>71 %</b>. Das schwerere Feld füllst du
        deshalb zuerst.
      </p>

      <h3 className="strat-h3">Der erste Zug</h3>
      <Stat n="89">verschiedene Entscheidungslagen im ersten Zug</Stat>
      <Stat n="32">mögliche Ergebnisse am Ende von Zug 1 bei bestem Spiel</Stat>
      <Stat n="6">davon erhöhen deinen erwarteten Endstand, zusammen unter 30 % Wahrscheinlichkeit</Stat>
      <p>
        Die meisten ersten Züge liegen also <b>unter dem Durchschnitt</b>. Das ist normal und
        kein Fehler. Jeder zusätzliche Würfel im oberen Teil bringt grob das <b>Dreifache seiner
        Augenzahl</b> an Erwartung. Für die Chance nennt das Video Werte von 19 bis 26 Punkten.
      </p>
      <p>
        Wer das Video-Rezept spielt, kommt laut Autor auf einen Schnitt von etwas über{' '}
        <b>255 Punkten</b> (45 Online-Spiele).
      </p>

      <h3 className="strat-h3">Und gegen andere Spieler?</h3>
      <p>
        Das Video löst Kniffel für <b>einen Spieler, der seine Punkte maximiert</b>. Gegen
        Mitspieler ist die beste Strategie <b>nicht gelöst</b>: Die Zustände explodieren auf
        Billiarden.
      </p>
      <p>
        Als Faustregel (nicht berechnet): Liegst du hinten, spiel <b>riskanter</b> und jage
        Kniffel und Straßen. Liegst du vorn, spiel <b>sicher</b>.
      </p>
    </>
  )
}

// --- Seite ---------------------------------------------------------------------

const scrollToHelper = () => {
  const el = document.getElementById('strat-helper')
  if (!el) return
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
}

export default function Strategy({ onBack }) {
  // Der erste Abschnitt ist offen, damit sofort etwas Konkretes zu sehen ist.
  const [open, setOpen] = useState({ first: true })
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }))
  const acc = (id) => ({ id, open: !!open[id], onToggle: () => toggle(id) })

  return (
    <div className="strat-root">
      <div className="app-bar strat-bar">
        <button type="button" className="strat-back" onClick={onBack} aria-label="Zurück">
          ←
        </button>
        <span>STRATEGIE</span>
        <span className="strat-bar-gap" aria-hidden="true" />
      </div>

      <div className="strat-scroll">
        <div className="strat-wrap">
          <section className="glass-card strat-hero reveal" aria-labelledby="strat-hero-h">
            <h1 className="strat-h2" id="strat-hero-h">
              Die Kurzfassung in 3 Sätzen
            </h1>
            <ol className="strat-three">
              <li>
                <span className="strat-badge big">1</span>
                <div>
                  <b>Sammle gleiche Zahlen.</b>
                  <span>Paare, Drillinge, Vierlinge: Sie füllen die meisten Felder.</span>
                </div>
              </li>
              <li>
                <span className="strat-badge big">2</span>
                <div>
                  <b>Jage keine Straßen.</b>
                  <span>Nur wenn schon vier in Folge liegen, lohnt der Versuch.</span>
                </div>
              </li>
              <li>
                <span className="strat-badge big">3</span>
                <div>
                  <b>Spar dir Straßen und Chance fürs Ende auf.</b>
                  <span>Solange sie frei sind, hat fast jeder Wurf noch einen Platz.</span>
                </div>
              </li>
            </ol>
            <button type="button" className="btn-primary strat-try" onClick={scrollToHelper}>
              Zum Ausprobieren ↓
            </button>
          </section>

          <div className="reveal" style={{ '--i': 1 }}>
            <Helper />
          </div>

          <div className="reveal strat-accs" style={{ '--i': 2 }}>
            <Accordion
              title="Nach dem 1. Wurf: was behalten?"
              hint="9 Regeln"
              {...acc('first')}
            >
              <PriorityHint>
                <b>Prüfe die Regeln von oben nach unten.</b> Die erste, die passt, gilt.
              </PriorityHint>
              <Legend />
              <RuleList rules={FIRST_ROLL} />
              <h3 className="strat-h3">Das behältst du nie</h3>
              <ul className="strat-never">
                {NEVER.map((n, i) => (
                  <li key={i}>
                    <DiceRow dice={n.faces} avoid />
                    <span>{n.text}</span>
                  </li>
                ))}
              </ul>
            </Accordion>

            <Accordion
              title="Nach dem 2. Wurf"
              hint="12 Regeln"
              {...acc('second')}
            >
              <PriorityHint>
                <b>Gleiches Spiel, jetzt bleibt nur noch ein Wurf.</b> Wieder von oben nach
                unten, die erste passende Regel gilt.
              </PriorityHint>
              <Legend />
              <RuleList rules={SECOND_ROLL} />
            </Accordion>

            <Accordion title="Wo trage ich ein?" {...acc('where')}>
              <div className="strat-tip">
                <b>Drei oder vier Gleiche lieber oben eintragen</b>, nicht beim Dreier- oder
                Viererpasch.
                <div className="strat-tip-art">
                  <DiceRow dice={[4, 4, 4]} keep={[true, true, true]} />
                  <span className="strat-ex-cap">→ Vierer-Feld oben</span>
                </div>
                Die oberen Felder sind später schwerer zu füllen. Der Pasch klappt fast immer
                irgendwann.
              </div>
              <div className="strat-tip">
                <b>Kleine Straße, Große Straße und Chance möglichst lange offen lassen.</b>
                <div className="strat-chips" aria-hidden="true">
                  <span>Kleine Straße</span>
                  <span>Große Straße</span>
                  <span>Chance</span>
                </div>
                Solange sie frei sind, hat fast jeder Wurf noch einen Platz.
              </div>
            </Accordion>

            <Accordion title="Endspiel" {...acc('end')}>
              <div className="strat-tip">
                Sind nur noch wenige Felder offen, zählt nur eins: <b>Welche Würfel bringen dir
                im Schnitt die meisten Punkte</b> für genau diese Felder?
              </div>
              <div className="strat-tip">
                Beim <b>Dreier- oder Viererpasch</b> lohnt es sich manchmal, lieber hohe Würfel
                zu behalten als die sicherste Variante.
              </div>
              <div className="strat-tip">
                Für die <b>Straßen</b>: Ohne 3 und 4 im Wurf würfelst du alles neu.
              </div>
              <div className="strat-tip note">
                In dieser App bringt ein <b>zweiter Kniffel keinen Extrabonus</b>. Die
                Videoregeln zum 100-Punkte-Bonus gelten hier nicht.
              </div>
            </Accordion>

            <Accordion
              title="Warum funktioniert das?"
              hint="Mathe für Neugierige"
              {...acc('math')}
            >
              <Theory />
            </Accordion>
          </div>

          <section className="glass-card strat-source" aria-labelledby="strat-src-h">
            <h2 className="strat-h2" id="strat-src-h">
              Quelle
            </h2>
            <p>
              Diese Seite fasst das Video <b>„I Solved Yahtzee*“</b> von <b>Ballpark Figures</b>{' '}
              (Patrick Liscio) in einfachen Worten zusammen. Alle Idee und Rechenarbeit stammen
              von ihm. Die Regellisten folgen den Tabellen zum Video. Fehler in der
              Vereinfachung gehen auf das Konto dieser App.
            </p>
            <a href={VIDEO_URL} target="_blank" rel="noopener noreferrer" className="strat-link">
              Das Video auf YouTube
            </a>
            <a href={POST_URL} target="_blank" rel="noopener noreferrer" className="strat-link">
              Der Artikel mit allen Tabellen
            </a>
          </section>
        </div>
      </div>
    </div>
  )
}
