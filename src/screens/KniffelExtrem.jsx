import { useState } from 'react'
import ScoreInputModal from '../components/ScoreInputModal'
import { calculateUpperBalance, calculateTotal } from '../logic/calculator'
import { saveGame } from '../storage'

const CATS_NORMAL = ['1','2','3','4','5','6','SUMME','3er','4er','FH','KL STR','GR STR','KNFFL','CHNC','TOTAL']
const CATS_TOP_DOWN = CATS_NORMAL  // 0→14 zwingend nacheinander
const CATS_BOTTOM_UP = [...CATS_NORMAL].reverse() // 14→0 zwingend nacheinander

function refreshTotals(playerScores) {
  const now = Date.now()
  return {
    ...playerScores,
    6: { value: calculateUpperBalance(playerScores), timestamp: now },
    14: { value: calculateTotal(playerScores), timestamp: now },
  }
}

// Nächster erlaubter Index für Top-Down (aufsteigend, skip SUMME=6 und TOTAL=14)
function nextAllowedTopDown(playerScores) {
  for (let i = 0; i <= 14; i++) {
    if (i === 6 || i === 14) continue // auto-berechnet
    if (!playerScores[i]) return i
  }
  return null
}

// Nächster erlaubter Index für Bottom-Up (absteigend, skip SUMME=6 und TOTAL=14)
function nextAllowedBottomUp(playerScores) {
  for (let i = 14; i >= 0; i--) {
    if (i === 6 || i === 14) continue
    if (!playerScores[i]) return i
  }
  return null
}

function BlockColumn({ title, label, categories, playerScores, nextAllowed, onTap, pIdx }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 80, borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ height: 36, background: '#673ab7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 'bold', color: 'black' }}>
        {label}
      </div>
      {categories.map((cat, i) => {
        const realIdx = CATS_NORMAL.indexOf(cat)
        const entry = playerScores[realIdx]
        const isAuto = realIdx === 6 || realIdx === 14
        const isNext = realIdx === nextAllowed
        const isClickable = !isAuto && isNext

        return (
          <div
            key={i}
            onClick={isClickable ? () => onTap(pIdx, realIdx) : undefined}
            style={{
              flex: 1, minHeight: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13,
              color: isNext ? '#f5a623' : 'white',
              background: isNext
                ? 'rgba(245,166,35,0.1)'
                : isAuto ? 'rgba(255,255,255,0.05)' : 'transparent',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              cursor: isClickable ? 'pointer' : 'default',
              fontWeight: isAuto ? 'bold' : 'normal',
              opacity: entry ? 1 : isNext ? 1 : 0.3,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {entry
              ? (realIdx >= 7 || entry.value < 0 ? entry.value : `+${entry.value}`)
              : isNext ? '→' : '-'}
          </div>
        )
      })}
    </div>
  )
}

export default function KniffelExtrem({ onExit }) {
  const [phase, setPhase] = useState('setup')
  const [players, setPlayers] = useState([])
  const [newName, setNewName] = useState('')

  // scores[pIdx] = { topDown: {}, bottomUp: {}, normal: {} }
  const [scores, setScores] = useState({})
  const [modal, setModal] = useState(null) // { pIdx, cIdx, block }
  const [restartDialog, setRestartDialog] = useState(false)

  function addPlayer() {
    const name = newName.trim()
    if (!name) return
    const idx = players.length
    setPlayers(prev => [...prev, name])
    setScores(prev => ({ ...prev, [idx]: { topDown: {}, bottomUp: {}, normal: {} } }))
    setNewName('')
  }

  function updateScore(pIdx, block, cIdx, value, isKniffel = false) {
    setScores(prev => {
      const blockScores = {
        ...prev[pIdx][block],
        [cIdx]: { value, timestamp: Date.now(), isKniffel }
      }
      return {
        ...prev,
        [pIdx]: {
          ...prev[pIdx],
          [block]: refreshTotals(blockScores),
        }
      }
    })
    setModal(null)
  }

  function removeScore(pIdx, block, cIdx) {
    setScores(prev => {
      const blockScores = { ...prev[pIdx][block] }
      delete blockScores[cIdx]
      return {
        ...prev,
        [pIdx]: { ...prev[pIdx], [block]: refreshTotals(blockScores) }
      }
    })
    setModal(null)
  }

  function getTotal(pIdx) {
    const s = scores[pIdx]
    if (!s) return 0
    return (s.topDown[14]?.value ?? 0) +
           (s.bottomUp[14]?.value ?? 0) +
           (s.normal[14]?.value ?? 0)
  }

  function finishGame() {
    const totals = players.map((_, pIdx) => getTotal(pIdx))
    const max = Math.max(...totals)
    const winners = players.filter((_, pIdx) => totals[pIdx] === max)
    const kniffelCounts = players.map((_, pIdx) => {
      const s = scores[pIdx]
      return ['topDown', 'bottomUp', 'normal'].reduce((sum, block) =>
        sum + Object.values(s[block] || {}).filter(e => e.isKniffel).length, 0
      )
    })
    saveGame({ mode: 'extrem', players, scores, winners, kniffelCounts })
    setPhase('result')
  }

  function handleRestart() {
    setPlayers([])
    setScores({})
    setPhase('setup')
    setRestartDialog(false)
  }

  if (phase === 'setup') return (
    <div style={{ position: 'fixed', inset: 0, background: '#1e1e1e', display: 'flex', flexDirection: 'column', padding: 24, gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onExit} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#673ab7', fontWeight: 'bold', fontSize: 20, letterSpacing: 3 }}>🔥 KNIFFEL EXTREM</div>
      </div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
        Drei Blöcke gleichzeitig — von oben, von unten, normal.
      </div>

      {players.map((name, i) => (
        <div key={i} style={{ color: 'white', background: 'rgba(103,58,183,0.15)', borderRadius: 10, padding: '10px 14px' }}>
          {name}
        </div>
      ))}

      <input
        className="dialog-input"
        placeholder="Name..."
        value={newName}
        onChange={e => setNewName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && addPlayer()}
        autoFocus
      />
      <button className="btn-outline" onClick={addPlayer}>Spieler hinzufügen</button>

      {players.length >= 1 && (
        <button className="btn-primary" style={{ marginTop: 'auto' }} onClick={() => setPhase('game')}>
          SPIEL STARTEN →
        </button>
      )}
    </div>
  )

  if (phase === 'result') {
    const results = players.map((name, pIdx) => ({ name, total: getTotal(pIdx) }))
      .sort((a, b) => b.total - a.total)
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#1e1e1e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <div style={{ fontSize: 48 }}>🔥</div>
        <div style={{ color: '#673ab7', fontWeight: 'bold', fontSize: 22, letterSpacing: 3 }}>ERGEBNIS</div>
        {results.map((r, i) => (
          <div key={i} style={{
            width: '100%', maxWidth: 340,
            background: i === 0 ? 'rgba(103,58,183,0.3)' : 'rgba(255,255,255,0.05)',
            border: i === 0 ? '2px solid #673ab7' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '14px 18px',
          }}>
            <div style={{ color: 'white', fontWeight: 'bold' }}>{i === 0 ? '🏆 ' : ''}{r.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Gesamt: {r.total}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button className="btn-outline" onClick={handleRestart}>Nochmal</button>
          <button className="btn-primary" onClick={onExit}>Menü</button>
        </div>
      </div>
    )
  }

  // Game Phase
  return (
    <div className="app">
      <div className="app-bar" style={{ fontSize: 14 }}>
        <button onClick={() => setRestartDialog(true)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer', padding: '0 8px' }}>←</button>
        🔥 EXTREM
        <button className="btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={finishGame}>ENDE</button>
      </div>

      <div className="game-area">
        {/* Kategorien-Spalte */}
        <div className="categories-column">
          <div className="cat-header">KAT</div>
          {CATS_NORMAL.map((cat, i) => (
            <div key={i} className="cat-cell">{cat}</div>
          ))}
        </div>

        {/* Pro Spieler 3 Blöcke */}
        <div className="players-area">
          {players.map((name, pIdx) => {
            const s = scores[pIdx]
            const nextTD = nextAllowedTopDown(s.topDown)
            const nextBU = nextAllowedBottomUp(s.bottomUp)

            return (
              <div key={pIdx} style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Spieler-Header über alle 3 Blöcke */}
                <div style={{
                  display: 'flex',
                  height: 36,
                  background: '#673ab7',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  color: 'black',
                  fontSize: 12,
                  borderLeft: '1px solid rgba(255,255,255,0.1)',
                  gridColumn: 'span 3',
                }}>
                  {name} · {getTotal(pIdx)}
                </div>
                <div style={{ display: 'flex' }}>
                  <BlockColumn
                    label="↓" pIdx={pIdx}
                    categories={CATS_NORMAL}
                    playerScores={s.topDown}
                    nextAllowed={nextTD}
                    onTap={(p, c) => setModal({ pIdx: p, cIdx: c, block: 'topDown' })}
                  />
                  <BlockColumn
                    label="↑" pIdx={pIdx}
                    categories={CATS_NORMAL}
                    playerScores={s.bottomUp}
                    nextAllowed={nextBU}
                    onTap={(p, c) => setModal({ pIdx: p, cIdx: c, block: 'bottomUp' })}
                  />
                  <BlockColumn
                    label="~" pIdx={pIdx}
                    categories={CATS_NORMAL}
                    playerScores={s.normal}
                    nextAllowed={null} // frei
                    onTap={(p, c) => setModal({ pIdx: p, cIdx: c, block: 'normal' })}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="footer">
        <button className="btn-danger" onClick={() => setRestartDialog(true)}>RESTART</button>
        <button className="btn-primary" onClick={finishGame}>AUSWERTEN →</button>
      </div>

      {modal && (
        <ScoreInputModal
          pIdx={modal.pIdx}
          cIdx={modal.cIdx}
          categories={CATS_NORMAL}
          onClose={() => setModal(null)}
          onSave={(val, isKniffel) => updateScore(modal.pIdx, modal.block, modal.cIdx, val, isKniffel)}
          onDelete={() => removeScore(modal.pIdx, modal.block, modal.cIdx)}
        />
      )}

      {restartDialog && (
        <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && setRestartDialog(false)}>
          <div className="dialog">
            <div className="dialog-title">Abbrechen?</div>
            <div className="dialog-actions">
              <button className="btn-outline" onClick={() => setRestartDialog(false)}>Weiter</button>
              <button className="btn-danger" onClick={handleRestart}>Beenden</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}