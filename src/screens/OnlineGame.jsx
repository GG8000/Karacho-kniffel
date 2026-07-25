import { useCallback, useEffect, useState } from 'react'
import PlayerColumn from '../components/PlayerColumn'
import ScoreInputModal from '../components/ScoreInputModal'
import { useAuth } from '../auth/AuthContext'
import { CATEGORIES, isBoardComplete, withTotals } from '../logic/kniffel'
import { calculateTotal } from '../logic/calculator'
import {
  fetchGame,
  subscribeGame,
  playTurn,
  setStatus,
} from '../lib/liveGame'
import { saveGame } from '../storage'
import Spinner from '../components/Spinner'

export default function OnlineGame({ gameId, onExit }) {
  const { profile } = useAuth()
  const meId = profile?.id
  const [game, setGame] = useState(null)
  const [players, setPlayers] = useState([])
  const [scores, setScores] = useState([])
  const [modal, setModal] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    fetchGame(gameId)
      .then(({ game, players, scores }) => {
        setGame(game)
        setPlayers(players)
        setScores(scores)
      })
      .catch((e) => setError(e.message ?? 'Fehler beim Laden.'))
  }, [gameId])

  useEffect(() => {
    load()
    const unsubscribe = subscribeGame(gameId, load)
    return unsubscribe
  }, [gameId, load])

  // Zellen nach Spieler gruppieren
  const scoresByPlayer = {}
  for (const s of scores) {
    ;(scoresByPlayer[s.profile_id] ??= {})[s.category_index] = {
      value: s.value,
      isKniffel: s.is_kniffel,
    }
  }

  const isHost = game && meId === game.host_id
  const playing = game?.status === 'playing'
  const mySeat = players.find((p) => p.profileId === meId)?.seat
  const currentPlayer = players.find((p) => p.seat === game?.current_turn)
  const isMyTurn = playing && mySeat != null && mySeat === game?.current_turn
  const complete = isBoardComplete(
    players.map((p) => p.profileId),
    scoresByPlayer,
  )

  async function handleSave(val, isKniffel) {
    setSubmitting(true)
    setModal(null)
    try {
      await playTurn(gameId, modal.cIdx, val, isKniffel)
      load()
    } catch (e) {
      setError(e.message ?? 'Zug nicht möglich.')
    } finally {
      setSubmitting(false)
    }
  }

  // Host wertet aus: Endergebnis in die Statistik schreiben + Status 'done'
  async function handleEvaluate() {
    setSaving(true)
    try {
      const totals = players.map((p) =>
        calculateTotal(scoresByPlayer[p.profileId] || {}),
      )
      const max = Math.max(...totals)
      await saveGame({
        mode: 'normal',
        players: players.map((p) => p.name),
        identities: players.map((p) => p.profileId),
        finalScores: totals,
        isWinners: totals.map((t) => t === max),
        kniffelCounts: players.map(
          (p) =>
            Object.values(scoresByPlayer[p.profileId] || {}).filter(
              (e) => e.isKniffel,
            ).length,
        ),
      })
      await setStatus(gameId, 'done')
    } catch (e) {
      setError(e.message ?? 'Auswerten fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  if (!game) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#1e1e1e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        {error ? (
          <span style={{ color: '#ff5252', fontSize: 13 }}>{error}</span>
        ) : (
          <Spinner label="Lade Spiel…" />
        )}
      </div>
    )
  }

  // Ergebnis-Screen
  if (game.status === 'done') {
    const results = players
      .map((p) => ({
        name: p.name,
        total: calculateTotal(scoresByPlayer[p.profileId] || {}),
      }))
      .sort((a, b) => b.total - a.total)

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#1e1e1e',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
        }}
      >
        <div style={{ fontSize: 48 }}>🏆</div>
        <div
          style={{
            color: '#673ab7',
            fontWeight: 'bold',
            fontSize: 22,
            letterSpacing: 3,
          }}
        >
          AUSWERTUNG
        </div>
        {results.map((r, i) => (
          <div
            key={i}
            style={{
              width: '100%',
              maxWidth: 340,
              background:
                i === 0 ? 'rgba(103,58,183,0.3)' : 'rgba(255,255,255,0.05)',
              border:
                i === 0
                  ? '2px solid #673ab7'
                  : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ color: 'white', fontWeight: 'bold' }}>
              {i === 0 ? '🏆 ' : i === 1 ? '🥈 ' : '🥉 '}
              {r.name}
            </div>
            <div style={{ color: '#673ab7', fontWeight: 'bold', fontSize: 18 }}>
              {r.total}
            </div>
          </div>
        ))}
        <button
          className="btn-primary"
          style={{ marginTop: 8 }}
          onClick={onExit}
        >
          Zum Menü →
        </button>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="app-bar" style={{ fontSize: 15 }}>
        <button
          onClick={onExit}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: 18,
            cursor: 'pointer',
            padding: '0 8px',
          }}
        >
          ←
        </button>
        🌐 ONLINE
        <div style={{ width: 40 }} />
      </div>

      {playing && currentPlayer && (
        <div
          style={{
            flexShrink: 0,
            padding: '8px 12px',
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 'bold',
            background: isMyTurn
              ? 'rgba(105,255,71,0.15)'
              : 'rgba(103,58,183,0.18)',
            color: isMyTurn ? '#69ff47' : '#b39ddb',
          }}
        >
          {submitting ? (
            <Spinner row label="Zug wird übertragen…" size={14} />
          ) : isMyTurn ? (
            '▶ Du bist dran — wähle eine Kategorie'
          ) : (
            `⏳ ${currentPlayer.name} ist dran…`
          )}
        </div>
      )}

      <div className="game-area">
        <div className="categories-column">
          <div className="cat-header">KAT</div>
          {CATEGORIES.map((cat, i) => (
            <div key={i} className="cat-cell">
              {cat}
            </div>
          ))}
        </div>

        <div className="players-area">
          {players.map((p) => (
            <PlayerColumn
              key={p.profileId}
              pIdx={p.profileId}
              name={p.profileId === meId ? `${p.name} (du)` : p.name}
              categories={CATEGORIES}
              playerScores={withTotals(scoresByPlayer[p.profileId] || {})}
              canEdit={isMyTurn && p.profileId === meId}
              onTap={(_, cIdx) => {
                if (scoresByPlayer[meId]?.[cIdx]) return // schon belegt
                setModal({ cIdx })
              }}
            />
          ))}
        </div>
      </div>

      <div className="footer">
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          {isHost
            ? complete
              ? 'Alle fertig — auswerten!'
              : 'Reihum eintragen…'
            : 'Der Host wertet am Ende aus.'}
        </div>
        {isHost && (
          <button
            className="btn-primary"
            onClick={handleEvaluate}
            disabled={saving}
            style={{ opacity: complete ? 1 : 0.6 }}
          >
            {saving ? <Spinner row label="Speichere…" size={16} /> : 'AUSWERTEN →'}
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: 0,
            right: 0,
            textAlign: 'center',
            color: '#ff5252',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {modal && (
        <ScoreInputModal
          pIdx={meId}
          cIdx={modal.cIdx}
          categories={CATEGORIES}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={() => setModal(null)}
        />
      )}
    </div>
  )
}
