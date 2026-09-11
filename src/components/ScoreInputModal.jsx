import { useState, useEffect, useRef } from 'react'
import { celebrateKniffel } from '../lib/celebrate'
import { announceStrike } from '../lib/strike'
import { WHEEL_MIN, WHEEL_MAX, kniffelFaceFor } from '../logic/kniffel'
import PickerWheel from './PickerWheel'
import Die from './Die'

// Sheet für die beiden Kategorien, die einen echten Wert brauchen:
// 3er/4er/CHNC über das Auswahlrad und die Kniffel-Zeile über die Augenzahl.
// Der obere Teil und FH/KL STR/GR STR werden direkt in der Zelle
// durchgeklickt (siehe logic/kniffel.js nextCellState) und landen hier nicht
// mehr.

const KNIFFEL_POINTS = 50

const clampSum = (n) => Math.min(WHEEL_MAX, Math.max(WHEEL_MIN, Math.round(n)))

// Am Laptop gibt es eine echte Tastatur — dort lohnen sich Zahlenfeld und
// Tastenhinweise. Am Handy bleibt das Sheet unverändert, dort wäre beides nur
// im Weg. (pointer: fine) trennt Maus/Trackpad zuverlässiger von Touch als eine
// Breiten-Abfrage, die am Tablet im Querformat danebenliegt.
function useHasKeyboard() {
  const query = '(pointer: fine)'
  const [fine, setFine] = useState(
    () => window.matchMedia?.(query).matches ?? false,
  )

  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const onChange = (e) => setFine(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return fine
}

export default function ScoreInputModal({ pIdx, cIdx, categories, playerName, defaultValue, onClose, onSave, onDelete }) {
  const catName = categories[cIdx]
  const isKniffelRow = catName === 'KNFFL'
  const isWheel = !isKniffelRow

  // Startwert des Rads: typischer Wert dieses Spielers (falls vorhanden),
  // sonst wie bisher 15. Darf beim Tippen im Zahlenfeld kurz '' sein —
  // gerechnet wird immer mit sumValue.
  const start = defaultValue ?? 15
  const [rawVal, setRawVal] = useState(start)
  const [claimKniffel, setClaimKniffel] = useState(false)

  const hasKeyboard = useHasKeyboard()
  const numberRef = useRef(null)

  const typed = rawVal === '' ? null : Number(rawVal)
  const sumValue = clampSum(Number.isFinite(typed) ? typed : start)

  // Ein Kniffel ist nur möglich, wenn die Summe fünf gleiche Würfel sein KANN.
  const kniffelFace = isWheel ? kniffelFaceFor(sumValue) : null
  const claimed = Boolean(kniffelFace) && claimKniffel

  useEffect(() => {
    setRawVal(start)
    setClaimKniffel(false)
  }, [cIdx, start])

  // Rutscht das Rad auf einen Wert, der kein Kniffel sein kann, verfällt das
  // Häkchen — sonst bliebe es unsichtbar gesetzt.
  useEffect(() => {
    if (!kniffelFace) setClaimKniffel(false)
  }, [kniffelFace])

  // Speichert und feuert bei einem Kniffel zusätzlich die Feier ab. Läuft für
  // alle Spielmodi, weil sie sich dieses Sheet teilen. face wandert nur im
  // Normal-Modus bis in die Statistik — die anderen Modi speichern kein
  // Kategorie-Raster, dort treibt sie nur die Animation.
  function save(value, isKniffel, face = null) {
    if (isKniffel) celebrateKniffel({ kind: isKniffelRow ? 'category' : 'upper', face })
    onSave(value, isKniffel, face)
  }

  function confirmWheel() {
    save(sumValue, claimed, claimed ? kniffelFace : null)
  }

  // Streichen ist hier eine bewusste Eingabe und knallt deshalb sofort — anders
  // als im oberen Teil, wo lib/strike.js erst abwartet. Dieses Sheet teilen
  // sich alle Spielmodi, also hängt daran 3er/4er/CHNC/KNFFL überall.
  function strike() {
    announceStrike({ cIdx, category: catName, playerName })
    onSave(0, false)
  }

  // Zahlenfeld beim Öffnen scharf stellen und den Wert markieren, damit die
  // erste getippte Ziffer ihn ersetzt statt sich anzuhängen.
  useEffect(() => {
    if (isWheel && hasKeyboard) numberRef.current?.select()
  }, [cIdx, isWheel, hasKeyboard])

  // Tastatur-Eingabe am Laptop. Der Handler hängt am document, weil beim Öffnen
  // noch nichts im Sheet den Fokus hat.
  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (isWheel) {
        // Ziffern gehören ins Zahlenfeld, Pfeiltasten ins Rad — hier nur
        // bestätigen.
        if (e.key === 'Enter') {
          e.preventDefault()
          confirmWheel()
        }
        return
      }

      // Kniffel-Zeile: Augenzahl direkt tippen, 0 streicht.
      const digit = /^[0-9]$/.test(e.key) ? Number(e.key) : null
      if (digit === 0) {
        e.preventDefault()
        strike()
        return
      }
      if (digit === null || digit > 6) return
      e.preventDefault()
      save(KNIFFEL_POINTS, true, digit)
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pIdx, cIdx, isWheel, sumValue, claimed, kniffelFace])

  const keyHint = isWheel ? (
    <>
      <kbd>↑</kbd><kbd>↓</kbd> wählt · <kbd>Enter</kbd> bestätigt ·{' '}
      <kbd>Esc</kbd> schließt
    </>
  ) : (
    <>
      <kbd>1</kbd>–<kbd>6</kbd> = Augenzahl · <kbd>0</kbd> = Streichen ·{' '}
      <kbd>Esc</kbd> schließt
    </>
  )

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

        {isWheel ? (
          <>
            <div style={{ fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
              {catName}: {sumValue} Punkte
            </div>

            <PickerWheel
              min={WHEEL_MIN}
              max={WHEEL_MAX}
              value={sumValue}
              onChange={(n) => setRawVal(n)}
            />

            {/* Kniffel-Rückfrage — nur wenn die Summe fünf gleiche Würfel sein
                kann (Vielfaches von 5 im Radbereich). */}
            {kniffelFace && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: claimed
                    ? '1px solid rgba(255,196,0,0.7)'
                    : '1px solid rgba(255,255,255,0.12)',
                  background: claimed ? 'rgba(255,196,0,0.12)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={claimed}
                  onChange={(e) => setClaimKniffel(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#ffc400' }}
                />
                <span style={{ fontSize: 15 }}>5 ×</span>
                <Die face={kniffelFace} size={22} />
                <span style={{ fontSize: 15, fontWeight: 'bold' }}>= Kniffel!</span>
              </label>
            )}

            {hasKeyboard && (
              <input
                ref={numberRef}
                className="dialog-input"
                type="number"
                inputMode="numeric"
                min={WHEEL_MIN} max={WHEEL_MAX} step={1}
                value={rawVal}
                onChange={e => setRawVal(e.target.value)}
                // Der Wert wird erst beim Verlassen eingefangen, damit man beim
                // Tippen zwischendurch leeren darf.
                onBlur={() => setRawVal(sumValue)}
                style={{ textAlign: 'center', fontSize: 18 }}
              />
            )}

            {defaultValue != null && (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                ≈ dein typischer Wert
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn-delete" onClick={onDelete}>
                🗑 Löschen
              </button>
              <button className="btn-delete" onClick={strike}>
                ❌ Streichen
              </button>
              <button className="btn-primary" onClick={confirmWheel}>
                Bestätigen
              </button>
            </div>
            {hasKeyboard && <div className="key-hint">{keyHint}</div>}
          </>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>
              Eintrag für {catName}
            </div>

            {/* Kniffel-Zeile: die Augenzahl wird direkt angetippt. Ein Tap wie
                vorher beim OK-Button, liefert aber die Daten für die Statistik. */}
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
                  onClick={() => save(KNIFFEL_POINTS, true, face)}
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
              onClick={strike}
              style={{ alignSelf: 'center' }}
            >
              Streichen
            </button>

            {hasKeyboard && <div className="key-hint">{keyHint}</div>}

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
