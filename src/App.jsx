import { useState, useRef } from 'react'
import PlayerColumn from './components/PlayerColumn'
import ScoreInputModal from './components/ScoreInputModal'
import { calculateUpperBalance, calculateTotal } from './logic/calculator'
import './App.css'

const CATEGORIES = [
  '1', '2', '3', '4', '5', '6', 'SUMME',
  '3er', '4er', 'FH', 'KL STR', 'GR STR', 'KNFFL', 'CHNC', 'TOTAL'
]

function refreshTotals(playerScores) {
  const now = Date.now()
  const upperBalance = calculateUpperBalance(playerScores)
  const total = calculateTotal(playerScores)
  return {
    ...playerScores,
    6: { value: upperBalance, timestamp: now },
    14: { value: total, timestamp: now },
  }
}

export default function App() {
  const [players, setPlayers] = useState(['Troni'])
  const [scores, setScores] = useState({ 0: {} })
  const [modal, setModal] = useState(null)
  const [addDialog, setAddDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef(null)

  function updateScore(pIdx, cIdx, value) {
    setScores(prev => {
      const now = Date.now()
      const playerScores = { ...prev[pIdx], [cIdx]: { value, timestamp: now } }
      return { ...prev, [pIdx]: refreshTotals(playerScores) }
    })
    setModal(null)
  }

  function removeScore(pIdx, cIdx) {
    setScores(prev => {
      const playerScores = { ...prev[pIdx] }
      delete playerScores[cIdx]
      return { ...prev, [pIdx]: refreshTotals(playerScores) }
    })
    setModal(null)
  }

  function handleAddPlayer() {
    const name = newName.trim()
    if (!name) return
    const idx = players.length
    setPlayers(prev => [...prev, name])
    setScores(prev => ({ ...prev, [idx]: {} }))
    setNewName('')
    setAddDialog(false)
  }

  function openAddDialog() {
    setNewName('')
    setAddDialog(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="app">
      <div className="app-bar">KNIFFEL BLOCK</div>

      <div className="game-area">
        <div className="categories-column">
          <div className="cat-header">KAT</div>
          {CATEGORIES.map((cat, i) => (
            <div key={i} className="cat-cell">{cat}</div>
          ))}
        </div>

        <div className="players-area">
          {players.map((name, pIdx) => (
            <PlayerColumn
              key={pIdx}
              pIdx={pIdx}
              name={name}
              categories={CATEGORIES}
              playerScores={scores[pIdx] || {}}
              onTap={(pIdx, cIdx) => setModal({ pIdx, cIdx })}
            />
          ))}
        </div>
      </div>

      <div className="footer">
        <button className="btn-outline">HISTORY</button>
        <button className="btn-primary" onClick={openAddDialog}>ADD PLAYER</button>
      </div>

      {modal && (
        <ScoreInputModal
          pIdx={modal.pIdx}
          cIdx={modal.cIdx}
          categories={CATEGORIES}
          onClose={() => setModal(null)}
          onSave={val => updateScore(modal.pIdx, modal.cIdx, val)}
          onDelete={() => removeScore(modal.pIdx, modal.cIdx)}
        />
      )}

      {addDialog && (
        <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && setAddDialog(false)}>
          <div className="dialog">
            <div className="dialog-title">Neuer Spieler</div>
            <input
              ref={inputRef}
              className="dialog-input"
              placeholder="Name eingeben..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
              autoFocus
            />
            <div className="dialog-actions">
              <button className="btn-outline" onClick={() => setAddDialog(false)}>Abbrechen</button>
              <button className="btn-primary" onClick={handleAddPlayer}>Hinzufügen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
