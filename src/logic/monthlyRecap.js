// Monatsrückblick: Kennzahlen für einen Kalendermonat plus ein kurzer,
// regelbasierter Textreport. Reine Funktionen — Datenquelle ist getHistory().
//
// Wichtig: Punktzahlen sind zwischen den Modi nicht vergleichbar (im
// Extrem-Modus summieren sich drei Blöcke). Spiele/Siege/Kniffel zählen deshalb
// über alle Modi, Ø- und Bestleistung nur über den Normal-Modus.

import { keyOf } from './stats'

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

export function monthKeyOf(iso) {
  const d = new Date(iso ?? 0)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key) {
  const [y, m] = (key ?? '').split('-').map(Number)
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${y}` : '—'
}

export function prevMonthKey(key) {
  const [y, m] = key.split('-').map(Number)
  return m === 1
    ? `${y - 1}-12`
    : `${y}-${String(m - 1).padStart(2, '0')}`
}

// Alle Monate mit Spielen, neuester zuerst.
export function availableMonths(games) {
  const set = new Set()
  for (const g of games ?? []) {
    const k = monthKeyOf(g.playedAt)
    if (k) set.add(k)
  }
  return [...set].sort().reverse()
}

function shortDate(iso) {
  const d = new Date(iso ?? 0)
  return Number.isNaN(d.getTime())
    ? ''
    : ` am ${d.getDate()}.${d.getMonth() + 1}.`
}

function aggregate(games, monthKey) {
  const inMonth = (games ?? []).filter(
    (g) => monthKeyOf(g.playedAt) === monthKey,
  )
  const players = {}
  const byMode = {}

  for (const g of inMonth) {
    byMode[g.mode ?? 'normal'] = (byMode[g.mode ?? 'normal'] ?? 0) + 1
    const isNormal = g.mode === 'normal'

    for (const p of g.participants ?? []) {
      const key = keyOf(p)
      const s = (players[key] ??= {
        key,
        name: p.name ?? '?',
        played: 0,
        wins: 0,
        kniffel: 0,
        normalGames: 0,
        normalSum: 0,
        bestScore: 0,
      })
      if (p.name) s.name = p.name
      s.played++
      if (p.isWinner) s.wins++
      s.kniffel += p.kniffelCount ?? 0

      if (isNormal) {
        const score = p.finalScore ?? 0
        s.normalGames++
        s.normalSum += score
        s.bestScore = Math.max(s.bestScore, score)
      }
    }
  }

  for (const s of Object.values(players)) {
    s.winRate = s.played ? s.wins / s.played : 0
    s.avgScore = s.normalGames ? Math.round(s.normalSum / s.normalGames) : null
  }
  return { games: inMonth, players, byMode }
}

function buildReport(r) {
  if (!r.gamesPlayed) return ['In diesem Monat wurde nicht gespielt.']

  const out = []
  const diff = r.gamesPlayed - r.prevGamesPlayed
  out.push(
    `${r.gamesPlayed} ${r.gamesPlayed === 1 ? 'Spiel' : 'Spiele'} im ${r.label}` +
      (r.prevGamesPlayed
        ? ` — ${diff > 0 ? `${diff} mehr` : diff < 0 ? `${-diff} weniger` : 'genauso viele'} als im Vormonat.`
        : '.'),
  )

  if (r.champion?.wins > 0) {
    if (r.tied.length > 1) {
      const names = r.tied.map((p) => p.name)
      out.push(
        `Kopf-an-Kopf: ${names.slice(0, -1).join(', ')} und ${names.at(-1)} mit je ${r.champion.wins} Siegen.`,
      )
    } else {
      const c = r.champion
      out.push(
        `Monatssieger: ${c.name} mit ${c.wins} ${c.wins === 1 ? 'Sieg' : 'Siegen'} aus ${c.played} ${c.played === 1 ? 'Spiel' : 'Spielen'}.`,
      )
    }
  }

  if (r.bestGame) {
    const when = shortDate(r.bestGame.playedAt)
    out.push(
      `Höchstes Ergebnis: ${r.bestGame.score} Punkte von ${r.bestGame.name}${when || '.'}`,
    )
  }

  if (r.improver) {
    out.push(
      `Am meisten gesteigert: ${r.improver.name} mit Ø +${r.improver.delta} Punkten zum Vormonat.`,
    )
  }

  if (r.totalKniffel > 0) {
    const king = r.kniffelKing
    out.push(
      `${r.totalKniffel} Kniffel insgesamt` +
        (king?.kniffel > 0
          ? `, die meisten von ${king.name} (${king.kniffel}).`
          : '.'),
    )
  } else {
    out.push('Kein einziger Kniffel — zäher Monat.')
  }

  return out
}

export function computeMonthlyRecap(games, monthKey) {
  const cur = aggregate(games, monthKey)
  const prev = aggregate(games, prevMonthKey(monthKey))

  const players = Object.values(cur.players).sort(
    (a, b) => b.wins - a.wins || (b.avgScore ?? 0) - (a.avgScore ?? 0),
  )

  // Steigerung ggü. Vormonat — nur sinnvoll, wenn in BEIDEN Monaten
  // Normal-Spiele vorliegen.
  for (const p of players) {
    const before = prev.players[p.key]
    p.prevAvg = before?.avgScore ?? null
    p.delta =
      p.avgScore != null && before?.avgScore != null
        ? p.avgScore - before.avgScore
        : null
  }

  // Bestes Einzelergebnis des Monats (nur Normal-Modus, s. Kopfkommentar).
  let bestGame = null
  for (const g of cur.games) {
    if (g.mode !== 'normal') continue
    for (const p of g.participants ?? []) {
      const score = p.finalScore ?? 0
      if (!bestGame || score > bestGame.score) {
        bestGame = { name: p.name ?? '?', score, playedAt: g.playedAt }
      }
    }
  }

  const champion = players[0] ?? null
  const tied = champion
    ? players.filter((p) => p.wins === champion.wins && p.wins > 0)
    : []
  const kniffelKing = [...players].sort((a, b) => b.kniffel - a.kniffel)[0]
  const improver = players
    .filter((p) => p.delta != null && p.delta > 0)
    .sort((a, b) => b.delta - a.delta)[0]

  const recap = {
    monthKey,
    label: monthLabel(monthKey),
    gamesPlayed: cur.games.length,
    prevGamesPlayed: prev.games.length,
    byMode: cur.byMode,
    players,
    champion,
    tied,
    bestGame,
    kniffelKing: kniffelKing ?? null,
    improver: improver ?? null,
    totalKniffel: players.reduce((n, p) => n + p.kniffel, 0),
  }
  recap.report = buildReport(recap)
  return recap
}
