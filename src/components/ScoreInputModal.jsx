import { useState, useEffect } from 'react'
import { celebrateKniffel } from '../lib/celebrate'
import Die from './Die'

const FIX_POINTS = { 'FH': 25, 'KL STR': 30, 'GR STR': 40, 'KNFFL': 50 }

export default function ScoreInputModal({ pIdx, cIdx, categories, defaultValue, onClose, onSave, onDelete }) {
  const catName = categories[cIdx]
  const isSlider = ['3er', '4er', 'CHNC'].includes(catName)
  const isFixed = catName in FIX_POINTS
  const isUpperDice = cIdx < 6

  // Startwert des Sliders: typischer Wert dieses Spielers (falls vorhanden),
  // sonst wie bisher 15.
  const start = defaultValue ?? 15
  const [sliderVal, setSliderVal] = useState(start)

  useEffect(() => {
    setSliderVal(start)
  }, [cIdx, start])


  const isKniffelRow = catName === 'KNFFL'

  // Speichert und feuert bei einem Kniffel zusätzlich die Feier ab. Läuft für
  // alle Spielmodi, weil sie sich dieses Modal teilen. face wandert nur im
  // Normal-Modus bis in die Statistik — die anderen Modi speichern kein
  // Kategorie-Raster, dort treibt sie nur die Animation.
  function save(value, isKniffel, face = null) {
    if (isKniffel) celebrateKniffel({ kind: isKniffelRow ? 'category' : 'upper', face })
    onSave(value, isKniffel, face)
  }

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
            {defaultValue != null && (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                ≈ dein typischer Wert
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn-delete" onClick={onDelete}>
                🗑 Löschen
              </button>
              <button className="btn-delete" onClick={() => onSave(0, false)}>
                ❌ Streichen 
              </button>
              <button className="btn-primary" onClick={() => onSave(sliderVal, false)}>
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
                {diceButtons.map(({ label, val }, index) => (
                  <button
                    key={label}
                    className="btn-grid-item"
                    onClick={() =>                          // ← 5x = automatisch Kniffel
                      save(val, index === 5, index === 5 ? cIdx + 1 : null)
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : isKniffelRow ? (
              // Kniffel-Zeile: die Augenzahl wird direkt angetippt. Ein Tap wie
              // vorher beim OK-Button, liefert aber die Daten für die Statistik.
              <>
                <div
                  style={{
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: 14,
                  }}
                >
                  Welchen Kniffel?
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                    justifyItems: 'center',
                  }}
                >
                  {[1, 2, 3, 4, 5, 6].map((face) => (
                    <button
                      key={face}
                      aria-label={`Kniffel mit ${face}`}
                      onClick={() => save(FIX_POINTS[catName], true, face)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 4,
                        cursor: 'pointer',
                        lineHeight: 0,
                      }}
                    >
                      <Die face={face} size="min(17vw, 62px)" />
                    </button>
                  ))}
                </div>
                <button
                  className="btn-grid-item"
                  onClick={() => onSave(0, false)}
                  style={{ alignSelf: 'center' }}
                >
                  Streichen
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-evenly' }}>
                <button
                  className="btn-primary"
                  onClick={() => save(FIX_POINTS[catName], false)}
                >
                  OK
                </button>
                <button className="btn-grid-item" onClick={() => onSave(0, false)}>
                  Streichen
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