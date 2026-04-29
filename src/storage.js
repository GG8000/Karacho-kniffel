const KEY = 'kniffel-history'

export function saveGame(game) {
  const history = getHistory()
  history.push({
    id: Date.now(),
    date: new Date().toISOString(),
    ...game,
  })
  localStorage.setItem(KEY, JSON.stringify(history))
}

export function getHistory() {
  const raw = localStorage.getItem(KEY)
  return raw ? JSON.parse(raw) : []
}

export function clearHistory() {
  localStorage.removeItem(KEY)
}

// Statistiken pro Spieler berechnen
export function getPlayerStats() {
  const history = getHistory()
  const stats = {}

  function ensurePlayer(name) {
    if (!stats[name]) {
      stats[name] = {
        name,
        gamesPlayed: 0,
        wins: 0,
        totalKniffel: 0,
        totalGamesWithKniffel: 0,
        opponents: {}, // { opponentName: { played, won, lost } }
      }
    }
  }

  for (const game of history) {
    const { players, scores, winners, kniffelCounts } = game

    players.forEach(name => ensurePlayer(name))

    players.forEach((name, pIdx) => {
      stats[name].gamesPlayed++

      const kniffel = kniffelCounts?.[pIdx] ?? 0
      stats[name].totalKniffel += kniffel
      if (kniffel > 0) stats[name].totalGamesWithKniffel++

      if (winners?.includes(name)) stats[name].wins++

      // Gegner-Statistik
      players.forEach((opponent, oIdx) => {
        if (opponent === name) return
        if (!stats[name].opponents[opponent]) {
          stats[name].opponents[opponent] = { played: 0, won: 0, lost: 0 }
        }
        stats[name].opponents[opponent].played++
        if (winners?.includes(name)) stats[name].opponents[opponent].won++
        else stats[name].opponents[opponent].lost++
      })
    })
  }

  return stats
}

