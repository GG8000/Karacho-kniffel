import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useAuth } from '../auth/AuthContext'
import QrScanner from '../components/QrScanner'
import PlayerOrderList from '../components/PlayerOrderList'
import Spinner from '../components/Spinner'
import OnlineGame from './OnlineGame'
import {
  createGame,
  joinByCode,
  fetchGame,
  subscribeGame,
  startGame,
  reorderPlayers,
  leaveGame,
} from '../lib/liveGame'

export default function OnlineLobby({ onBack }) {
  const { isLoggedIn, profile, signInWithGoogle } = useAuth()
  const [gameId, setGameId] = useState(null)
  const [joinCode, setJoinCode] = useState(null) // Anzeige beim Host
  const [snap, setSnap] = useState(null) // { game, players, scores }
  const [codeInput, setCodeInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [qrSrc, setQrSrc] = useState(null)
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!gameId) return
    const load = () => fetchGame(gameId).then(setSnap).catch(() => {})
    load()
    return subscribeGame(gameId, load)
  }, [gameId])

  useEffect(() => {
    if (!joinCode) {
      setQrSrc(null)
      return
    }
    QRCode.toDataURL(joinCode, {
      margin: 1,
      width: 200,
      color: { dark: '#1e1e1e', light: '#ffffff' },
    })
      .then(setQrSrc)
      .catch(() => setQrSrc(null))
  }, [joinCode])

  async function handleCreate() {
    setBusy(true)
    setBusyLabel('Spiel wird erstellt…')
    setError(null)
    try {
      const { id, join_code } = await createGame('normal')
      setJoinCode(join_code)
      setGameId(id)
    } catch (e) {
      setError(e.message ?? 'Konnte Spiel nicht erstellen.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(code) {
    const value = (code ?? codeInput).trim()
    if (!value) return
    setBusy(true)
    setBusyLabel('Trete Spiel bei…')
    setError(null)
    try {
      const { id } = await joinByCode(value)
      setGameId(id)
    } catch (e) {
      setError(e.message ?? 'Beitreten fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    if (gameId) leaveGame(gameId).catch(() => {})
    setGameId(null)
    setJoinCode(null)
    setSnap(null)
    setCodeInput('')
    setError(null)
  }

  const shell = (children) => (
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
      {children}
    </div>
  )

  // Nicht angemeldet
  if (!isLoggedIn) {
    return shell(
      <>
        <div style={{ fontSize: 40 }}>🌐</div>
        <div
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 14,
            textAlign: 'center',
            maxWidth: 300,
          }}
        >
          Online gegeneinander spielen geht nur angemeldet.
        </div>
        <button
          className="btn-primary"
          style={{ width: '100%', maxWidth: 320 }}
          onClick={() => signInWithGoogle().catch(() => {})}
        >
          Mit Google anmelden
        </button>
        <button className="btn-outline" onClick={onBack}>
          ← Zurück
        </button>
      </>,
    )
  }

  // Spiel läuft/fertig → Spielbildschirm
  if (snap && snap.game.status !== 'lobby') {
    return <OnlineGame gameId={gameId} onExit={reset} />
  }

  if (scanning) {
    return (
      <QrScanner
        onScan={(text) => {
          setScanning(false)
          handleJoin(text)
        }}
        onClose={() => setScanning(false)}
      />
    )
  }

  // Lobby angefragt, aber Zustand noch nicht da → laden
  if (gameId && !snap) {
    return shell(<Spinner label="Lade Lobby…" />)
  }

  // In der Lobby
  if (gameId) {
    const isHost = snap && profile?.id === snap.game.host_id
    const players = snap?.players ?? []
    return shell(
      <>
        <div
          style={{
            color: '#673ab7',
            fontWeight: 'bold',
            fontSize: 20,
            letterSpacing: 3,
          }}
        >
          🌐 LOBBY
        </div>

        {isHost && joinCode && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(103,58,183,0.12)',
              border: '1px solid rgba(103,58,183,0.3)',
              borderRadius: 12,
              padding: 18,
            }}
          >
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
              Beitritts-Code
            </div>
            {qrSrc && (
              <img
                src={qrSrc}
                alt="Beitritts-QR"
                width={180}
                height={180}
                style={{ borderRadius: 8, background: 'white', padding: 6 }}
              />
            )}
            <div
              style={{
                color: '#b39ddb',
                fontSize: 28,
                fontWeight: 'bold',
                letterSpacing: 4,
              }}
            >
              {joinCode}
            </div>
          </div>
        )}

        <div style={{ width: '100%', maxWidth: 320 }}>
          <div
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 12,
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            REIHENFOLGE ({players.length}){isHost && ' — mit ▲▼ ordnen'}
          </div>
          <PlayerOrderList
            players={players}
            canReorder={isHost}
            hostId={snap?.game.host_id}
            meId={profile?.id}
            onCommit={(ids) =>
              reorderPlayers(gameId, ids).catch((e) => setError(e.message))
            }
          />
        </div>

        {isHost ? (
          <button
            className="btn-primary"
            style={{ width: '100%', maxWidth: 320 }}
            disabled={players.length < 2}
            onClick={() => startGame(gameId).catch((e) => setError(e.message))}
          >
            {players.length < 2 ? 'Warte auf Mitspieler…' : 'SPIEL STARTEN →'}
          </button>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            Warte auf den Host…
          </div>
        )}

        {error && <div style={{ color: '#ff5252', fontSize: 13 }}>{error}</div>}
        <button className="btn-outline" onClick={reset}>
          Verlassen
        </button>
      </>,
    )
  }

  // Menü: erstellen oder beitreten
  return shell(
    <>
      <div style={{ fontSize: 40 }}>🌐</div>
      <div
        style={{
          color: '#673ab7',
          fontWeight: 'bold',
          fontSize: 22,
          letterSpacing: 3,
        }}
      >
        ONLINE
      </div>
      <div
        style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: 13,
          textAlign: 'center',
          maxWidth: 320,
        }}
      >
        Jeder würfelt bei sich mit echten Würfeln — die Tabelle seht ihr live.
      </div>

      <button
        className="btn-primary"
        style={{ width: '100%', maxWidth: 320 }}
        onClick={handleCreate}
        disabled={busy}
      >
        Neues Spiel erstellen
      </button>

      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
        oder einem Spiel beitreten
      </div>

      <input
        className="dialog-input"
        style={{ maxWidth: 320, textAlign: 'center', letterSpacing: 4, textTransform: 'uppercase' }}
        placeholder="CODE"
        value={codeInput}
        onChange={(e) => setCodeInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
      />
      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 320 }}>
        <button
          className="btn-outline"
          style={{ flex: 1 }}
          onClick={() => setScanning(true)}
        >
          📷 Scannen
        </button>
        <button
          className="btn-primary"
          style={{ flex: 1 }}
          onClick={() => handleJoin()}
          disabled={busy}
        >
          Beitreten
        </button>
      </div>

      {busy && (
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
          <Spinner row label={busyLabel} />
        </div>
      )}
      {error && <div style={{ color: '#ff5252', fontSize: 13 }}>{error}</div>}
      <button className="btn-outline" onClick={onBack}>
        ← Zurück
      </button>
    </>,
  )
}
