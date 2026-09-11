// Lädt für den Auswertungs-Screen, was das gerade beendete Spiel am Rating
// ändert. Der gemeinsame Pfad aller vier Spielmodi.
//
// Bewusst dieselbe Vorverarbeitung wie in screens/Statistics.jsx: erst
// getHistory(), dann applyStatRules() mit den geladenen Regeln. Sonst weicht
// die Vorschau bei zusammengelegten oder ausgeblendeten Spielern von der
// Rangliste ab. Das neue Spiel wird an die ROHE Historie gehängt und läuft mit
// durch die Regeln — so greifen die Merges auch für dieses Spiel.

import { useEffect, useMemo, useState } from 'react'
import { getHistory } from '../storage'
import { loadStatRules } from './statRules'
import { applyStatRules, resolveKey } from '../logic/applyStatRules'
import { keyOf } from '../logic/stats'
import { ratingPreview, withoutMatchingGame } from '../logic/ratingPreview'

// Markiert das angehängte Spiel, damit es nach applyStatRules wiederzufinden ist.
const PREVIEW_ID = '__preview__'

const EMPTY = { rows: [], loading: false }

// participants: Teilnehmer im Historien-Format (storage.js toParticipants()).
// active: erst auf dem Auswertungs-Screen wird überhaupt geladen.
// alreadySaved: das Spiel steht schon in der Historie (Online-Modus, siehe
//   withoutMatchingGame) und muss für den Vorher-Stand herausgerechnet werden.
//
// -> { rows, loading }. rows liegt INDEXGLEICH zu participants, damit die
//    Screens ihre nach Punkten sortierte Ergebnisliste nicht umbauen müssen;
//    wer durch die Statistik-Regeln verschwindet, steht als null darin. Solange
//    geladen wird, bei einem Solospiel und wenn etwas schiefgeht, ist rows leer
//    — der Auswertungs-Screen darf daran nie hängen.
export function useRatingPreview(participants, { active, alreadySaved } = {}) {
  const [state, setState] = useState(EMPTY)

  // participants ist bei jedem Render ein neues Array — der Effect hängt
  // deshalb an einer Signatur aus Spieler und Endpunktzahl, nicht am Array.
  const signature = useMemo(
    () => participants.map((p) => `${keyOf(p)}=${p.finalScore ?? 0}`).join('|'),
    [participants],
  )

  useEffect(() => {
    if (!active || participants.length < 2) {
      setState(EMPTY)
      return
    }
    let cancelled = false
    setState({ rows: [], loading: true })

    Promise.all([getHistory(), loadStatRules()])
      .then(([history, rules]) => {
        if (cancelled) return
        const base = alreadySaved
          ? withoutMatchingGame(history, participants)
          : history
        const games = applyStatRules(
          [
            ...base,
            { id: PREVIEW_ID, playedAt: new Date().toISOString(), participants },
          ],
          rules,
        )
        // Über die id wiederfinden statt über die Position: applyStatRules
        // schreibt Teilnehmer um und lässt Spiele ganz weg, aus denen alle
        // ausgeblendet wurden — das neue kann eines davon sein.
        const preview = games.find((g) => g.id === PREVIEW_ID)
        if (!preview) {
          setState(EMPTY)
          return
        }
        const byKey = new Map(
          ratingPreview(
            games.filter((g) => g.id !== PREVIEW_ID),
            preview.participants,
          ).map((row) => [row.key, row]),
        )
        // Zurück auf die ursprüngliche Reihenfolge: ein zusammengelegter
        // Spieler steckt in der Vorschau unter seinem Ziel-Schlüssel.
        setState({
          rows: participants.map(
            (p) => byKey.get(resolveKey(keyOf(p), rules?.merges)) ?? null,
          ),
          loading: false,
        })
      })
      .catch(() => {
        if (!cancelled) setState(EMPTY)
      })

    return () => {
      cancelled = true
    }
    // participants steht bewusst NICHT in den Abhängigkeiten — dafür ist die
    // daraus gebildete signature da, sonst liefe der Effect bei jedem Render.
  }, [active, alreadySaved, signature])

  return state
}
