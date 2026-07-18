import { calculateUpperBalance, calculateTotal } from './calculator'

// Kategorien des normalen Kniffel-Blocks (Index 6 = SUMME, 14 = TOTAL sind
// abgeleitet, alle anderen werden eingetragen).
export const CATEGORIES = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  'SUMME',
  '3er',
  '4er',
  'FH',
  'KL STR',
  'GR STR',
  'KNFFL',
  'CHNC',
  'TOTAL',
]

export const PLAYABLE_INDICES = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13]

// Ergänzt die abgeleiteten Summenfelder (wie refreshTotals im lokalen Modus),
// damit PlayerColumn SUMME/TOTAL rendern kann.
export function withTotals(playerScores) {
  return {
    ...playerScores,
    6: { value: calculateUpperBalance(playerScores) },
    14: { value: calculateTotal(playerScores) },
  }
}

export function isBoardComplete(playerIds, scoresByPlayer) {
  return (
    playerIds.length > 0 &&
    playerIds.every((pid) =>
      PLAYABLE_INDICES.every((ci) => scoresByPlayer[pid]?.[ci] !== undefined),
    )
  )
}
