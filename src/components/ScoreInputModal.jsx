import { useState, useEffect } from 'react'

const FIX_POINTS = { 'FH': 25, 'KL STR': 30, 'GR STR': 40, 'KNFFL': 50 }

export default function ScoreInputModal({ pIdx, cIdx, categories, onClose, onSave, onDelete }) {
  const catName = categories[cIdx]
  const isSlider = ['3er', '4er', 'CHNC'].includes(catName)
  const isFixed = catName in FIX_POINTS
  const isUpperDice = cIdx < 6

  const [sliderVal, setSliderVal] = useState(15)

  useEffect(() => {
    setSliderVal(15)
  }, [cIdx])

  const diceButtons = Array.from({ length: 6 }, (_, index) => {
    const label = index === 0 ? 'X' : `${index}x`
    const val = index === 0 ? -((cIdx + 1) * 3) : (index - 3) * (cIdx + 1)
    return { label, val }
  })

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end',
        zIndex: 1000,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#1e1e1e',
        width: '100%',
        padding: '30px 24px 40px',
        borderRadius: '16px 16px 0 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>

        {isSlider ? (
          <>
            <div style={{ fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
              {catName}: {sliderVal} Punkte
            </div>
            <input
              type="range"
              min={5} max={30} step={1}
              value={sliderVal}
              onChange={e => setSliderVal(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#673ab7', height: 4 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn-delete" onClick={onDelete}>
                🗑 Löschen
              </button>
              <button className="btn-primary" onClick={() => onSave(sliderVal)}>
                Bestätigen
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>
              Eintrag für {catName}
            </div>

            {isUpperDice ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                {diceButtons.map(({ label, val }) => (
                  <button key={label} className="btn-grid-item" onClick={() => onSave(val)}>
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-evenly' }}>
                <button className="btn-primary" onClick={() => onSave(FIX_POINTS[catName])}>
                  OK
                </button>
                <button className="btn-grid-item" onClick={() => onSave(0)}>
                  X
                </button>
              </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
            <button className="btn-delete" onClick={onDelete} style={{ alignSelf: 'flex-start' }}>
              🗑 Löschen
            </button>
          </>
        )}
      </div>
    </div>
  )
}
