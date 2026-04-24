export function calculateUpperBalance(scores) {
  let balance = 0
  for (let i = 0; i < 6; i++) {
    if (scores[i] != null) balance += scores[i].value
  }
  return balance
}

export function calculateUpperAbsolutePoints(scores) {
  let total = 0
  for (let i = 0; i < 6; i++) {
    if (scores[i] != null) total += scores[i].value + (i + 1) * 3
  }
  return total
}

export function calculateTotal(scores) {
  const absUpper = calculateUpperAbsolutePoints(scores)
  const bonus = absUpper >= 63 ? 35 : 0
  let total = absUpper + bonus
  for (let i = 7; i < 14; i++) {
    if (scores[i] != null) total += scores[i].value
  }
  return total
}
