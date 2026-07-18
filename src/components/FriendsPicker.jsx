import { useEffect, useState } from 'react'
import { listFriends } from '../auth/friends'

// Wählt einen Freund aus der gespeicherten Liste — ohne erneutes Scannen.
export default function FriendsPicker({ onPick, onClose, takenIds = [] }) {
  const [friends, setFriends] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    listFriends()
      .then((list) => {
        if (!cancelled) setFriends(list)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message ?? 'Konnte Freunde nicht laden.')
          setFriends([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const available = (friends ?? []).filter((f) => !takenIds.includes(f.id))

  return (
    <div
      className="dialog-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dialog">
        <div className="dialog-title">Freund auswählen</div>

        {friends === null ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            Lade…
          </div>
        ) : available.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            Keine (weiteren) Freunde in deiner Liste. Scanne im Spiel einen
            QR-Code oder lege Freunde unter 👤 Konto an.
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            {available.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  onPick(f)
                  onClose()
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(103,58,183,0.15)',
                  border: '1px solid rgba(103,58,183,0.4)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontWeight: 'bold' }}>{f.display_name}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                  {f.handle}
                </span>
              </button>
            ))}
          </div>
        )}

        {error && <div style={{ color: '#ff5252', fontSize: 13 }}>{error}</div>}

        <div className="dialog-actions">
          <button className="btn-outline" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
