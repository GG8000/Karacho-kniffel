import { calculateUpperAbsolutePoints } from '../logic/calculator'

export default function PlayerColumn({ pIdx, name, categories, playerScores, onTap }) {
  const absolutePoints = calculateUpperAbsolutePoints(playerScores)

  function getCellText(cIdx) {
    const entry = playerScores[cIdx]
    if (!entry) return '-'
    const cat = categories[cIdx]
    const isUpperSum = cat === 'SUMME'
    const isLower = cIdx >= 7
    const val = entry.value
    if (isUpperSum) return String(absolutePoints)
    if (isLower || val < 0) return String(val)
    return `+${val}`
  }

  return (
    <div style={{
      width: 140,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{
        height: 50,
        flexShrink: 0,
        background: '#673ab7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        color: 'black',
        fontSize: 14,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        padding: '0 4px',
      }}>
        {name}
      </div>

      {categories.map((cat, cIdx) => {
        const isUpperSum = cat === 'SUMME'
        const isTotalRow = cat === 'TOTAL'
        const isSumRow = isUpperSum || isTotalRow
        const isUpperDice = cIdx >= 0 && cIdx <= 5
        const entry = playerScores[cIdx]
        const hasUpperEntry = isUpperDice && !!entry

        let color = 'white'
        if (isUpperSum && entry) {
          color = absolutePoints >= 63 ? '#69ff47' : '#ff5252'
        } else if (isTotalRow) {
          color = '#ce93d8'
        }

        return (
          <div
            key={cIdx}
            onClick={isSumRow ? undefined : () => onTap(pIdx, cIdx)}
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: isSumRow ? 'bold' : 'normal',
              backgroundColor: hasUpperEntry
                ? 'rgba(103,58,183,0.18)'
                : isSumRow ? 'rgba(255,255,255,0.07)' : 'transparent',
              borderBottom: isUpperSum
                ? '2px solid #673ab7'
                : '1px solid rgba(255,255,255,0.1)',
              borderRight: '1px solid rgba(255,255,255,0.1)',
              outline: hasUpperEntry ? '2px solid #673ab7' : 'none',
              outlineOffset: '-2px',
              color,
              cursor: isSumRow ? 'default' : 'pointer',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {getCellText(cIdx)}
          </div>
        )
      })}
    </div>
  )
}
