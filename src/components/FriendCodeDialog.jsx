import { useState } from 'react'
import { findProfileByHandle } from '../auth/friends'

// Sucht einen Mitspieler per Freund-Code und gibt sein Profil zurück.
// Wird von allen drei Spielmodi genutzt.
export default function FriendCodeDialog({ onClose, onResolve, takenIds = [] }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleFind() {
    const value = code.trim()
    if (!value) return
    setBusy(true)
    setError(null)
    try {
      const profile = await findProfileByHandle(value)
      if (!profile) {
        setError('Kein Spieler mit diesem Code gefunden.')
        setBusy(false)
        return
      }
      if (takenIds.includes(profile.id)) {
        setError(`${profile.display_name} ist schon dabei.`)
        setBusy(false)
        return
      }
      onResolve(profile)
      onClose()
    } catch (e) {
      setError(e.message ?? 'Suche fehlgeschlagen.')
      setBusy(false)
    }
  }

  return (
    <div
      className="dialog-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dialog">
        <div className="dialog-title">Freund per Code</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          Den Code findet dein Freund in der App unter 📊 Statistiken.
          Verknüpfte Spieler bekommen das Spiel auf ihre eigene Statistik — auf
          ihrem eigenen Handy.
        </div>
        <input
          className="dialog-input"
          placeholder="z.B. anna-4f2a"
          autoCapitalize="none"
          autoCorrect="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleFind()}
          autoFocus
        />
        {error && <div style={{ color: '#ff5252', fontSize: 13 }}>{error}</div>}
        <div className="dialog-actions">
          <button className="btn-outline" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn-primary" onClick={handleFind} disabled={busy}>
            {busy ? 'Suche…' : 'Übernehmen'}
          </button>
        </div>
      </div>
    </div>
  )
}
