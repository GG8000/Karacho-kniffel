import { calculateUpperAbsolutePoints } from '../logic/calculator'
import { formatCell } from '../logic/kniffel'

export default function PlayerColumn({ pIdx, name, categories, playerScores, onTap, onRemove, canEdit = true, pendingCIdx = null, armedCIdx = null }) {
  const absolutePoints = calculateUpperAbsolutePoints(playerScores)

  function getCellText(cIdx) {
    const cat = categories[cIdx]
    if (cat === 'SUMME') return String(absolutePoints)
    if (cat === 'TOTAL') return String(playerScores[cIdx]?.value ?? 0)
    return formatCell(cIdx, playerScores[cIdx])
  }

  return (
    <div style={{ width: 140, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--sheet-rule)' }}>
      <div style={{
        height: 50, flexShrink: 0, background: 'var(--sheet-head)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 'bold', color: 'var(--sheet-head-ink)', fontSize: 14,
        letterSpacing: 0.3,
        position: 'relative', padding: '0 24px 0 4px',
        overflow: 'hidden',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        {/* ✕ Button — nur wenn entfernbar (nicht im Online-Modus) */}
        {onRemove && (
          <button
            onClick={onRemove}
            style={{
              position: 'absolute', right: 4, top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.25)', border: 'none',
              color: 'var(--sheet-head-ink)', borderRadius: '50%',
              width: 18, height: 18, fontSize: 10,
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>
      {categories.map((cat, cIdx) => {
        const isUpperSum = cat === 'SUMME'
        const isTotalRow = cat === 'TOTAL'
        const isSumRow = isUpperSum || isTotalRow
        const isUpperDice = cIdx >= 0 && cIdx <= 5
        const entry = playerScores[cIdx]
        const hasUpperEntry = isUpperDice && !!entry
        const hasKniffelBonus = entry?.isKniffel === true  // ← das hat gefehlt

        // Bonus erreicht/verfehlt: Grün gegen Rot, wie in RatingDelta. TOTAL in
        // hellem Lila — #673ab7 selbst wäre als Schrift auf Dunkel zu schwach.
        let color = 'var(--sheet-ink)'
        if (isUpperSum && entry) {
          color = absolutePoints >= 63 ? 'var(--bonus-ok)' : 'var(--bonus-miss)'
        } else if (isTotalRow) {
          color = 'var(--sheet-accent)'
        }

        return (
          <div
            key={cIdx}
            onClick={isSumRow || !canEdit ? undefined : () => onTap(pIdx, cIdx)}
            style={{
              flex: 1,
              minHeight: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: isSumRow ? 'bold' : 'normal',
              // Gleich breite Ziffern, damit +1 und −2 untereinander ruhig stehen.
              fontVariantNumeric: 'tabular-nums',

              borderBottom: isUpperSum
                ? '2px solid var(--sheet-accent)'
                : '1px solid var(--sheet-rule)',
              borderRight: '1px solid var(--sheet-rule)',
              backgroundColor: isSumRow
                ? 'var(--sheet-sum)'
                : cIdx === armedCIdx
                  ? 'rgba(255,138,101,0.16)'
                  : 'transparent',
              color,
              cursor: isSumRow || !canEdit ? 'default' : 'pointer',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              position: 'relative',
            }}
          >
            {/* Fehltipp-Schutz: einmal angetippt, ein zweiter Tap ändert erst
                (siehe lib/useArmedCell.js). Durchgezogen statt gestrichelt, damit
                es nicht mit "vorgemerkt" darunter verwechselt wird. */}
            {cIdx === armedCIdx && (
              <span style={{
                position: 'absolute',
                inset: '3px',
                borderRadius: 6,
                border: '2px solid var(--armed)',
                pointerEvents: 'none',
              }} />
            )}
            {/* Online: lokal durchgeklickt, aber noch nicht abgeschickt. */}
            {cIdx === pendingCIdx && (
              <span style={{
                position: 'absolute',
                inset: '3px',
                borderRadius: 6,
                border: '2px dashed var(--armed)',
                pointerEvents: 'none',
              }} />
            )}
            {hasKniffelBonus && (
              <span style={{
                position: 'absolute',
                inset: '4px',
                borderRadius: '50%',
                border: '2px solid var(--kniffel-gold)',
                pointerEvents: 'none',
                boxShadow: '0 0 6px rgba(255,196,0,0.55)',
              }} />
            )}
            {getCellText(cIdx)}
          </div>
        )
      })}
    </div>
  )
}
