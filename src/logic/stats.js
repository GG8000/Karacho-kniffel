// Aggregiert die Spielhistorie zu Spieler-Statistiken inkl. eines fairen
// ELO-artigen Ratings. Reine Funktion — Datenquelle ist getHistory().
//
// games: [{ id, mode, playedAt, participants:[{ profileId, name,
//            finalScore, isWinner, kniffelCount }] }]

const START_RATING = 1000
const K = 24

export function keyOf(p) {
  return p.profileId ? `p:${p.profileId}` : `g:${(p.name ?? '').toLowerCase()}`
}

export function computeStats(games) {
  const stats = {}
  const rating = {}

  function ensure(key, name, isAccount) {
    if (!stats[key]) {
      stats[key] = {
        id: key,
        name,
        isAccount,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        totalKniffel: 0,
        sumScore: 0,
        bestScore: 0,
        scoreHistory: [], // [{ playedAt, score, mode }]
        form: [], // [bool] chronologisch
        opponents: {}, // { name: { played, won, lost } }
      }
      rating[key] = START_RATING
    } else if (name) {
      stats[key].name = name
    }
  }

  const ordered = [...games].sort((a, b) =>
    (a.playedAt ?? '').localeCompare(b.playedAt ?? ''),
  )

  for (const game of ordered) {
    const parts = game.participants ?? []
    parts.forEach((p) => ensure(keyOf(p), p.name, Boolean(p.profileId)))

    // Aggregat-Statistik
    parts.forEach((p) => {
      const s = stats[keyOf(p)]
      s.gamesPlayed++
      if (p.isWinner) s.wins++
      else s.losses++
      s.totalKniffel += p.kniffelCount ?? 0
      const score = p.finalScore ?? 0
      s.sumScore += score
      s.bestScore = Math.max(s.bestScore, score)
      s.scoreHistory.push({ playedAt: game.playedAt, score, mode: game.mode })
      s.form.push(Boolean(p.isWinner))

      parts.forEach((o) => {
        if (o === p) return
        const name = o.name ?? '?'
        const rec = (s.opponents[name] ??= { played: 0, won: 0, lost: 0 })
        rec.played++
        if (p.isWinner && !o.isWinner) rec.won++
        else if (!p.isWinner && o.isWinner) rec.lost++
      })
    })

    // ELO (mode-agnostisch über isWinner), erst berechnen dann anwenden
    const n = parts.length
    if (n >= 2) {
      const deltas = {}
      parts.forEach((a) => {
        const ka = keyOf(a)
        let delta = 0
        parts.forEach((b) => {
          if (a === b) return
          const kb = keyOf(b)
          const expected = 1 / (1 + 10 ** ((rating[kb] - rating[ka]) / 400))
          const actual =
            a.isWinner && !b.isWinner
              ? 1
              : !a.isWinner && b.isWinner
                ? 0
                : 0.5
          delta += K * (actual - expected)
        })
        deltas[ka] = delta / (n - 1)
      })
      Object.entries(deltas).forEach(([k, d]) => {
        rating[k] += d
      })
    }
  }

  // Abgeleitete Felder
  for (const key of Object.keys(stats)) {
    const s = stats[key]
    s.rating = Math.round(rating[key])
    s.winRate = s.gamesPlayed > 0 ? s.wins / s.gamesPlayed : 0
    s.avgScore = s.gamesPlayed > 0 ? Math.round(s.sumScore / s.gamesPlayed) : 0
  }

  return stats
}

// Aktuelle Siegesserie (positiv) bzw. Niederlagenserie (negativ) am Ende der Form.
export function currentStreak(form) {
  if (!form.length) return 0
  const last = form[form.length - 1]
  let n = 0
  for (let i = form.length - 1; i >= 0 && form[i] === last; i--) n++
  return last ? n : -n
}
