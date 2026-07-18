import { useState } from 'react'
import { findProfileByHandle, addFriend } from '../auth/friends'
import { parseScannedHandle } from '../lib/handle'
import QrScanner from './QrScanner'

// Sucht einen Mitspieler per Freund-Code (getippt oder per QR gescannt) und
// gibt sein Profil zurück. Wird von allen drei Spielmodi genutzt.
export default function FriendCodeDialog({ onClose, onResolve, takenIds = [] }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [scanning, setScanning] = useState(false)

  async function resolve(rawHandle) {
    const value = rawHandle.trim()
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
      // Freund merken, damit man ihn beim nächsten Mal ohne Scannen wählen kann
      addFriend(profile.id).catch(() => {})
      onResolve(profile)
      onClose()
    } catch (e) {
      setError(e.message ?? 'Suche fehlgeschlagen.')
      setBusy(false)
    }
  }

  function handleScan(text) {
    setScanning(false)
    const handle = parseScannedHandle(text)
    setCode(handle)
    resolve(handle)
  }

  if (scanning) {
    return <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />
  }

  return (
    <div
      className="dialog-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dialog">
        <div className="dialog-title">Freund per Code</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          Scanne den QR-Code deines Freundes oder tippe den Code (aus 👤 Konto).
          Verknüpfte Spieler bekommen das Spiel auf ihre eigene Statistik — auf
          ihrem eigenen Handy.
        </div>

        <button
          className="btn-outline"
          style={{ minHeight: 44 }}
          onClick={() => {
            setError(null)
            setScanning(true)
          }}
        >
          📷 QR-Code scannen
        </button>

        <input
          className="dialog-input"
          placeholder="oder Code tippen: z.B. anna-4f2a"
          autoCapitalize="none"
          autoCorrect="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && resolve(code)}
        />
        {error && <div style={{ color: '#ff5252', fontSize: 13 }}>{error}</div>}
        <div className="dialog-actions">
          <button className="btn-outline" onClick={onClose}>
            Abbrechen
          </button>
          <button
            className="btn-primary"
            onClick={() => resolve(code)}
            disabled={busy}
          >
            {busy ? 'Suche…' : 'Übernehmen'}
          </button>
        </div>
      </div>
    </div>
  )
}
