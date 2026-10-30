// Würfel-Helfer für den Strategie-Tab.
//
// Die Regeln sind die Entscheidungstabellen aus dem Video "I Solved Yahtzee*"
// (Ballpark Figures), auf Prioritäten verdichtet: von oben nach unten prüfen,
// die ERSTE passende Regel gewinnt. Sie gelten für den Spielstart mit leerem
// Block — später entscheidet zusätzlich, welche Felder noch offen sind.
//
// Diese Datei ist die einzige Quelle der Wahrheit: Strategy.jsx zeichnet die
// Regellisten aus denselben Daten (title/text/examples) und berechnet die
// Beispiel-Markierungen mit denselben match-Funktionen. So können Anzeige und
// Helfer nicht auseinanderlaufen.

// Zählt, wie oft jede Augenzahl vorkommt (Index 1..6).
function countFaces(dice) {
  const c = [0, 0, 0, 0, 0, 0, 0]
  for (const d of dice) c[d]++
  return c
}

// Eine Auswahl wie {3: 2, 4: 1} (Augenzahl -> Anzahl) auf die konkreten Würfel
// abbilden: pro Augenzahl werden die ersten passenden Würfel markiert.
function pick(dice, wanted) {
  const left = { ...wanted }
  return dice.map((d) => {
    if (left[d] > 0) {
      left[d]--
      return true
    }
    return false
  })
}

// Kurzschreibweisen für match-Funktionen. ctx = { dice, c } mit c = Zählung.
const all = (dice) => dice.map(() => true)
const has = (c, ...faces) => faces.every((f) => c[f] > 0)
const isLargeStraight = (c) => has(c, 2, 3, 4, 5) && (c[1] > 0 || c[6] > 0)
const isYahtzee = (c) => c.some((n) => n === 5)
const isFullHouse = (c) => c.includes(3) && c.includes(2)

// Höchste Augenzahl im Bereich [from, 6] mit mindestens n Würfeln, sonst 0.
function highest(c, from, n) {
  for (let f = 6; f >= from; f--) if (c[f] >= n) return f
  return 0
}

// Vier aufeinanderfolgende Augenzahlen, die im Wurf vorkommen: Startwert oder 0.
function smallStraightStart(c) {
  for (const s of [1, 2, 3]) if (has(c, s, s + 1, s + 2, s + 3)) return s
  return 0
}

const same = (dice, sorted) =>
  [...dice].sort((a, b) => a - b).join('') === sorted.join('')

// --- Erster Wurf ---------------------------------------------------------
// match(dice, c) liefert die Auswahl {Augenzahl: Anzahl} oder 'all' (= alle
// fünf, eintragen) oder null (passt nicht). examples: Beispielwürfe für die
// Anzeige. Jedes Beispiel MUSS von genau dieser Regel erfasst werden — das
// prüft der Selbsttest.
export const FIRST_ROLL = [
  {
    title: 'Kniffel oder Große Straße',
    text: 'Fünf Gleiche oder fünf in Folge: das ist schon fertig. Trag es ein.',
    action: 'score',
    examples: [[6, 6, 6, 6, 6], [2, 3, 4, 5, 6]],
    match: (dice, c) => (isYahtzee(c) || isLargeStraight(c) ? 'all' : null),
  },
  {
    title: 'Vier Gleiche',
    text: 'Behalte die vier gleichen Würfel.',
    examples: [[5, 5, 5, 5, 2]],
    match: (dice, c) => {
      const f = highest(c, 1, 4)
      return f ? { [f]: 4 } : null
    },
  },
  {
    title: 'Drei Gleiche',
    text: 'Behalte die drei gleichen, auch bei einem Full House.',
    examples: [[4, 4, 4, 6, 1]],
    match: (dice, c) => {
      const f = highest(c, 1, 3)
      return f ? { [f]: 3 } : null
    },
  },
  {
    title: 'Offene Straße 2-3-4-5',
    text: 'Behalte 2-3-4-5: Mit einer 1 oder 6 wird daraus die Große Straße.',
    examples: [[2, 3, 4, 5, 3]],
    match: (dice, c) => (has(c, 2, 3, 4, 5) ? { 2: 1, 3: 1, 4: 1, 5: 1 } : null),
  },
  {
    title: 'Paar aus 3ern bis 6ern',
    text: 'Behalte das Paar. Bei zwei Paaren nur das höhere.',
    examples: [[3, 3, 4, 6, 1], [3, 3, 6, 6, 2]],
    match: (dice, c) => {
      const f = highest(c, 3, 2)
      return f ? { [f]: 2 } : null
    },
  },
  {
    title: 'Andere Kleine Straßen',
    text: 'Behalte 1-2-3-4 oder 3-4-5-6.',
    examples: [[1, 2, 3, 4, 6], [3, 4, 5, 6, 1]],
    match: (dice, c) => {
      const s = smallStraightStart(c)
      return s ? { [s]: 1, [s + 1]: 1, [s + 2]: 1, [s + 3]: 1 } : null
    },
  },
  {
    title: 'Paar Zweier',
    text: 'Behalte das Paar Zweier.',
    examples: [[2, 2, 1, 4, 6]],
    match: (dice, c) => (c[2] >= 2 ? { 2: 2 } : null),
  },
  {
    title: 'Aus 1-1-3-4-5',
    text: 'Lass das Paar Einsen liegen und behalte nur 3-4-5.',
    examples: [[1, 1, 3, 4, 5]],
    match: (dice) => (same(dice, [1, 1, 3, 4, 5]) ? { 3: 1, 4: 1, 5: 1 } : null),
  },
  {
    title: 'Einzelne 4, 5 oder 6',
    text: 'Behalte nur einen dieser Würfel: lieber die 5, dann die 4, dann die 6.',
    examples: [[5, 6, 1, 1, 2], [4, 6, 1, 1, 2]],
    match: (dice, c) => {
      for (const f of [5, 4, 6]) if (c[f] > 0) return { [f]: 1 }
      return null
    },
  },
]

// Was du im ersten Wurf nicht behältst (nur Anzeige, keine match-Funktion nötig:
// die Reihenfolge oben sorgt schon dafür).
export const NEVER = [
  { faces: [1, 1], text: 'Ein Paar Einsen' },
  { faces: [2, 3, 4], text: '2-3-4 als Straßenansatz' },
  { faces: [3, 3, 5, 5], text: 'Zwei Paare' },
  { faces: [2, 2, 2, 6, 6], text: 'Ein Full House: nur die drei Gleichen bleiben' },
]

// --- Zweiter Wurf --------------------------------------------------------
export const SECOND_ROLL = [
  {
    title: 'Kniffel oder Große Straße',
    text: 'Das ist fertig. Trag es ein.',
    action: 'score',
    examples: [[6, 6, 6, 6, 6], [2, 3, 4, 5, 6]],
    match: (dice, c) => (isYahtzee(c) || isLargeStraight(c) ? 'all' : null),
  },
  {
    title: 'Vier Gleiche',
    text: 'Behalte die vier gleichen Würfel.',
    examples: [[5, 5, 5, 5, 3]],
    match: (dice, c) => {
      const f = highest(c, 1, 4)
      return f ? { [f]: 4 } : null
    },
  },
  {
    title: 'Kleine Straße',
    text: 'Behalte die vier in Folge und würfle auf die Große Straße.',
    examples: [[1, 2, 3, 4, 6], [2, 3, 4, 5, 2]],
    match: (dice, c) => {
      const s = smallStraightStart(c)
      return s ? { [s]: 1, [s + 1]: 1, [s + 2]: 1, [s + 3]: 1 } : null
    },
  },
  {
    title: 'Drei 4er, 5er oder 6er',
    text: 'Behalte die drei, auch wenn du ein Full House hättest.',
    examples: [[4, 4, 4, 1, 6], [5, 5, 5, 2, 2]],
    match: (dice, c) => {
      const f = highest(c, 4, 3)
      return f ? { [f]: 3 } : null
    },
  },
  {
    title: 'Full House mit kleinen Zahlen',
    text: 'Das ist gut genug. Trag es ein.',
    action: 'score',
    examples: [[2, 2, 2, 6, 6]],
    match: (dice, c) => (isFullHouse(c) ? 'all' : null),
  },
  {
    title: 'Andere Drillinge',
    text: 'Behalte die drei gleichen (hier Einser, Zweier oder Dreier).',
    examples: [[3, 3, 3, 1, 5]],
    match: (dice, c) => {
      const f = highest(c, 1, 3)
      return f ? { [f]: 3 } : null
    },
  },
  {
    title: 'Paar aus 4ern, 5ern oder 6ern',
    text: 'Behalte das Paar. Bei zwei Paaren nur das höhere.',
    examples: [[5, 5, 1, 2, 3], [4, 4, 6, 6, 1]],
    match: (dice, c) => {
      const f = highest(c, 4, 2)
      return f ? { [f]: 2 } : null
    },
  },
  {
    title: 'Straßenansatz 2-3-4 oder 3-4-5',
    text: 'Behalte die drei in Folge, auch neben einem Paar.',
    examples: [[3, 4, 5, 1, 1], [2, 3, 4, 6, 2]],
    match: (dice, c) => {
      if (has(c, 2, 3, 4)) return { 2: 1, 3: 1, 4: 1 }
      if (has(c, 3, 4, 5)) return { 3: 1, 4: 1, 5: 1 }
      return null
    },
  },
  {
    title: 'Paar Zweier oder Dreier',
    text: 'Behalte das Paar. Bei 1-1-2-2 und 1-1-3-3 beide Paare, bei 2-2-3-3 nur die 3er.',
    examples: [[3, 3, 1, 5, 6], [1, 1, 3, 3, 6], [2, 2, 3, 3, 5]],
    match: (dice, c) => {
      if (c[3] >= 2) return c[1] >= 2 ? { 1: 2, 3: 2 } : { 3: 2 }
      if (c[2] >= 2) return c[1] >= 2 ? { 1: 2, 2: 2 } : { 2: 2 }
      return null
    },
  },
  {
    title: 'Aus 1-1-3-4-6',
    text: 'Behalte nur 3-4.',
    examples: [[1, 1, 3, 4, 6]],
    match: (dice) => (same(dice, [1, 1, 3, 4, 6]) ? { 3: 1, 4: 1 } : null),
  },
  {
    title: 'Paar Einsen',
    text: 'Gibt es sonst nichts Passendes, behalte die Einsen.',
    examples: [[1, 1, 2, 5, 6]],
    match: (dice, c) => (c[1] >= 2 ? { 1: 2 } : null),
  },
  {
    title: 'Aus 1-2-3-5-6 oder 1-2-4-5-6',
    text: 'Aus 1-2-3-5-6 behalte 2-3-5, aus 1-2-4-5-6 behalte 4-5-6.',
    examples: [[1, 2, 3, 5, 6], [1, 2, 4, 5, 6]],
    match: (dice) => {
      if (same(dice, [1, 2, 3, 5, 6])) return { 2: 1, 3: 1, 5: 1 }
      if (same(dice, [1, 2, 4, 5, 6])) return { 4: 1, 5: 1, 6: 1 }
      return null
    },
  },
]

// Maske für eine Regel und einen Wurf, oder null wenn die Regel nicht passt.
export function ruleMask(rule, dice) {
  const m = rule.match(dice, countFaces(dice))
  if (!m) return null
  return m === 'all' ? all(dice) : pick(dice, m)
}

const REROLL_ALL_TEXT = 'Keine Regel passt. Würfle alle fünf Würfel neu.'

// dice: 5 Augenzahlen (1-6), rollNumber: 1 oder 2 (nach welchem Wurf du
// entscheidest). Liefert:
//   keep       Boolean je Würfel (true = behalten)
//   ruleIndex  Position in der Regelliste (0-basiert), -1 wenn keine passt
//   title/text Klartext zur Regel
//   action     'keep' | 'score' (eintragen) | 'rerollAll'
// Wirft nie: ungültige Eingaben werden wie "nichts behalten" behandelt.
export function advise(dice, rollNumber) {
  const valid =
    Array.isArray(dice) &&
    dice.length === 5 &&
    dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6)
  const none = (dice && dice.length === 5 ? dice : [0, 0, 0, 0, 0]).map(() => false)
  if (!valid) {
    return { keep: none, ruleIndex: -1, title: '', text: REROLL_ALL_TEXT, action: 'rerollAll' }
  }

  const rules = rollNumber === 2 ? SECOND_ROLL : FIRST_ROLL
  for (let i = 0; i < rules.length; i++) {
    const keep = ruleMask(rules[i], dice)
    if (keep) {
      return {
        keep,
        ruleIndex: i,
        title: rules[i].title,
        text: rules[i].text,
        action: rules[i].action ?? 'keep',
      }
    }
  }
  return { keep: none, ruleIndex: -1, title: 'Alles neu', text: REROLL_ALL_TEXT, action: 'rerollAll' }
}
