// Wendet die Statistik-Regeln (zusammenlegen / ausblenden) auf die Historie an,
// BEVOR sie in die Auswertung läuft.
//
// Der Ansatzpunkt ist bewusst die Historie und nicht keyOf(): computeStats,
// computeCategoryStats, computeOrderStats, computeKniffelFaces und
// computeMonthlyRecap benutzen keyOf alle einzeln. Wer die Spielerliste vorher
// zurechtlegt, muss keinen davon anfassen — und die Regeln wirken automatisch
// überall gleich, auch in Head-to-Head und Monatsrückblick.
//
// Die Spiele selbst bleiben unangetastet, siehe sql/stat_rules.sql.

import { keyOf } from './stats'

// Ketten auflösen: A→B→C ergibt C. Ein Zyklus (A→B→A) kann über die UI nicht
// entstehen, würde hier aber ewig laufen — deshalb die Abbruchbedingung.
export function resolveKey(key, merges = {}) {
  let current = key
  const seen = new Set([current])
  while (merges[current]) {
    const next = merges[current]
    if (seen.has(next)) break
    current = next
    seen.add(current)
  }
  return current
}

// Der zuletzt gespielte Name je Schlüssel. Gäste tippen ihren Namen jedes Mal
// neu, und die jüngste Schreibweise ist die wahrscheinlichste — dieselbe Regel
// wie in buildKnownPlayers() in storage.js.
export function nameByKey(games = []) {
  const names = new Map()
  const at = new Map()
  for (const game of games) {
    const played = Date.parse(game.playedAt ?? '') || 0
    for (const p of game.participants ?? []) {
      const name = (p.name ?? '').trim()
      if (!name) continue
      const key = keyOf(p)
      if (!names.has(key) || played >= (at.get(key) ?? 0)) {
        names.set(key, name)
        at.set(key, played)
      }
    }
  }
  return names
}

// Schreibt einen Teilnehmer so um, dass keyOf() den Ziel-Schlüssel ergibt.
function rewrite(participant, targetKey, names) {
  if (targetKey.startsWith('p:')) {
    return {
      ...participant,
      profileId: targetKey.slice(2),
      name: names.get(targetKey) ?? participant.name,
    }
  }
  // Gast-Ziel: der Schlüssel IST der kleingeschriebene Name. Ohne Treffer in
  // names lieber den Schlüssel selbst nehmen — ein fremder Name würde einen
  // anderen keyOf() erzeugen und die Zusammenlegung stillschweigend verfehlen.
  return {
    ...participant,
    profileId: null,
    name: names.get(targetKey) ?? targetKey.slice(2),
  }
}

// rules: { merges: { [vonKey]: zielKey }, hidden: [key, …] }
export function applyStatRules(games = [], rules) {
  const merges = rules?.merges ?? {}
  const hidden = new Set(rules?.hidden ?? [])
  if (Object.keys(merges).length === 0 && hidden.size === 0) return games

  const names = nameByKey(games)
  const out = []

  for (const game of games) {
    const participants = []
    const seen = new Set()

    for (const p of game.participants ?? []) {
      const key = keyOf(p)
      const target = resolveKey(key, merges)

      // Ausgeblendet wird am ZIEL geprüft: Wer in einen ausgeblendeten Spieler
      // hineingelegt wurde, verschwindet mit.
      if (hidden.has(target)) continue

      // Nach dem Zusammenlegen kann derselbe Mensch zweimal im selben Spiel
      // stehen. Das kann nicht stimmen — der erste Eintrag gewinnt.
      if (seen.has(target)) continue
      seen.add(target)

      participants.push(target === key ? p : rewrite(p, target, names))
    }

    // Ein Spiel, aus dem alle entfernt wurden, ist keins mehr. Bleibt dagegen
    // noch jemand übrig, zählt es weiter: Derjenige hat wirklich gespielt, und
    // sein Ergebnis gehört in seinen Verlauf.
    if (participants.length > 0) out.push({ ...game, participants })
  }

  return out
}
