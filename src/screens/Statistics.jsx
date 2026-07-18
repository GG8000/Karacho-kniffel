import { getPlayerStats, clearHistory } from '../storage'
import { useAuth } from '../auth/AuthContext'
import { useEffect, useState } from 'react'

export default function Statistics({ onBack }) {
  const { isLoggedIn } = useAuth()
  const [stats, setStats] = useState(null)
  const [selected, setSelected] = useState(null)
  const [clearDialog, setClearDialog] = useState(false)

  useEffect(() => {
    let cancelled = false
    getPlayerStats()
      .then((s) => {
        if (!cancelled) setStats(s)
      })
      .catch(() => {
        if (!cancelled) setStats({})
      })
    return () => {
      cancelled = true
    }
  }, [])

  const shell = (children) => (
    <div style={{ position: 'fixed', inset: 0, background: '#1e1e1e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      {children}
    </div>
  )

  if (stats === null) return shell(
    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>Lade Statistiken…</div>
  )

  const players = Object.values(stats)
  const selectedPlayer = selected ? stats[selected] : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1e1e1e', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="app-bar">
        <button onClick={selected ? () => setSelected(null) : onBack} style={{ background: 'none', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer', padding: '0 8px' }}>←</button>
        📊 STATISTIKEN
        <div style={{ width: 40 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {!selectedPlayer ? (
          // Spielerliste
          <>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
              {isLoggedIn
                ? '☁ = geräteübergreifend · Freund-Code unter 👤 Konto'
                : 'Nicht angemeldet — Statistiken nur auf diesem Gerät.'}
            </div>

            {players.length === 0 && (
              <div style={{
                color: 'rgba(255,255,255,0.4)', fontSize: 15,
                textAlign: 'center', padding: '32px 0',
              }}>
                📊 Noch keine Spiele gespeichert.
              </div>
            )}

            {players.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                style={{
                  background: 'rgba(103,58,183,0.15)',
                  border: '1px solid rgba(103,58,183,0.4)',
                  borderRadius: 12, padding: '14px 18px',
                  color: 'white', cursor: 'pointer',
                  textAlign: 'left', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                    {p.name} {p.isAccount && <span title="geräteübergreifend">☁</span>}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
                    {p.gamesPlayed} Spiele · {p.wins} Siege
                  </div>
                </div>
                <div style={{ color: '#673ab7', fontSize: 20 }}>›</div>
              </button>
            ))}

            {players.length > 0 && (
              <button
                onClick={() => setClearDialog(true)}
                style={{ marginTop: 8, background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', fontSize: 13, cursor: 'pointer' }}
              >
                Lokalen Verlauf löschen
              </button>
            )}
          </>
        ) : (
          // Detailansicht
          <>
            <div style={{ color: '#673ab7', fontWeight: 'bold', fontSize: 22 }}>{selectedPlayer.name}</div>

            {/* Kern-Stats */}
            {[
              ['🎮 Gespielte Spiele', selectedPlayer.gamesPlayed],
              ['🏆 Siege', selectedPlayer.wins],
              ['📉 Niederlage', selectedPlayer.gamesPlayed - selectedPlayer.wins],
              ['🎲 Kniffel gesamt', selectedPlayer.totalKniffel],
              ['🎲 Ø Kniffel pro Spiel', selectedPlayer.gamesPlayed > 0
                ? (selectedPlayer.totalKniffel / selectedPlayer.gamesPlayed).toFixed(2)
                : '–'],
              ['🔥 Spiele mit Kniffel', selectedPlayer.totalGamesWithKniffel],
              ['📈 Siegrate', selectedPlayer.gamesPlayed > 0
                ? `${Math.round((selectedPlayer.wins / selectedPlayer.gamesPlayed) * 100)}%`
                : '–'],
            ].map(([label, value]) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                padding: '10px 0', color: 'white',
              }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
                <span style={{ fontWeight: 'bold' }}>{value}</span>
              </div>
            ))}

            {/* Gegner-Statistik */}
            {Object.keys(selectedPlayer.opponents).length > 0 && (
              <>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 8, letterSpacing: 2 }}>
                  HEAD-TO-HEAD
                </div>
                {Object.entries(selectedPlayer.opponents)
                  .sort((a, b) => b[1].played - a[1].played)
                  .map(([opponent, record]) => (
                    <div key={opponent} style={{
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: 10, padding: '10px 14px',
                      display: 'flex', justifyContent: 'space-between',
                    }}>
                      <span style={{ color: 'white' }}>{opponent}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                        {record.played}× · {record.won}W {record.lost}L
                      </span>
                    </div>
                  ))}
              </>
            )}
          </>
        )}
      </div>

      {clearDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <div className="dialog-title">Lokalen Verlauf löschen?</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              Löscht nur den Zwischenspeicher auf diesem Gerät. Bereits synchronisierte Spiele bleiben in der Cloud.
            </div>
            <div className="dialog-actions">
              <button className="btn-outline" onClick={() => setClearDialog(false)}>Abbrechen</button>
              <button className="btn-danger" onClick={() => { clearHistory(); setClearDialog(false); onBack() }}>Löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
