// Was das gerade beendete Spiel am Rating ändert — für den Auswertungs-Screen.
//
// Das Rating ist keine gespeicherte Zahl, sondern ein Aggregat über die ganze
// Historie (siehe stats.js). Der Zuwachs entsteht deshalb aus zwei Durchläufen
// von computeStats(): einmal ohne, einmal mit dem neuen Spiel. Damit stimmt der
// Nachher-Wert exakt mit dem überein, was die Rangliste nach dem Speichern
// zeigt, und die ELO-Formel steht weiterhin nur an einer Stelle.
//
// games ist die ROHE Historie aus getHistory(); die Statistik-Regeln legt der
// Aufrufer darüber (siehe lib/useRatingPreview.js), damit auch das neue Spiel
// durch applyStatRules läuft.

import { computeStats, keyOf, START_RATING } from './stats'

// Ein Spiel und die Teilnehmerliste beschreiben dasselbe Ergebnis, wenn exakt
// dieselben Spieler mit exakt denselben Endpunktzahlen darin stehen.
function sameResult(game, participants) {
  const parts = game.participants ?? []
  if (parts.length !== participants.length) return false
  const want = new Map(participants.map((p) => [keyOf(p), p.finalScore ?? 0]))
  for (const p of parts) {
    const key = keyOf(p)
    if (!want.has(key) || want.get(key) !== (p.finalScore ?? 0)) return false
  }
  return true
}

// Entfernt HÖCHSTENS ein Spiel, das dieses Ergebnis schon enthält — das
// jüngste. Gebraucht wird das nur im Online-Modus: dort schreibt der Host das
// Spiel schon weg, bevor der Ergebnis-Screen erscheint, und die Vorschau
// braucht trotzdem den Stand davor. Findet sich nichts (noch nicht
// synchronisiert), bleibt die Liste unverändert und die Rechnung stimmt
// genauso.
export function withoutMatchingGame(games = [], participants = []) {
  let hitAt = -1
  let hitPlayed = -Infinity
  games.forEach((game, i) => {
    if (!sameResult(game, participants)) return
    const played = Date.parse(game.playedAt ?? '') || 0
    if (played >= hitPlayed) {
      hitPlayed = played
      hitAt = i
    }
  })
  return hitAt === -1 ? games : games.filter((_, i) => i !== hitAt)
}

// -> [{ key, name, before, after, delta }] in der Reihenfolge von participants.
//
// Unter zwei Teilnehmern ändert ELO nichts (computeStats rechnet erst ab n >= 2)
// — dann gibt es auch nichts anzuzeigen.
export function ratingPreview(games = [], participants = []) {
  if (participants.length < 2) return []

  const before = computeStats(games)
  const after = computeStats([
    ...games,
    { playedAt: new Date().toISOString(), participants },
  ])

  return participants.flatMap((p) => {
    const key = keyOf(p)
    // Wer durch die Statistik-Regeln ausgeblendet ist, taucht in after gar
    // nicht auf — für den gibt es kein Rating und also auch keine Zeile.
    if (!after[key]) return []
    const from = before[key]?.rating ?? START_RATING
    const to = after[key].rating
    return [{ key, name: p.name, before: from, after: to, delta: to - from }]
  })
}
