import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

export const NAME_CONFIRMED_KEY = 'kniffel-name-confirmed'

// Einmaliger Schritt nach dem Login: Spielernamen festlegen.
// Der Name ist die Brücke zwischen Block und Account — wer sich im Spiel genau
// so einträgt, bekommt das Spiel auf seine Statistik (siehe auth/identity.js).
export default function ProfileSetup({ onDone }) {
  const { profile, session, updateDisplayName } = useAuth()
  // Google liefert den echten Namen mit — besser als der E-Mail-Präfix,
  // den der DB-Trigger als Default setzt.
  const googleName =
    session?.user?.user_metadata?.full_name ??
    session?.user?.user_metadata?.name
  const [name, setName] = useState(googleName ?? profile?.display_name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    const value = name.trim()
    if (!value) return
    setBusy(true)
    setError(null)
    try {
      await updateDisplayName(value)
      localStorage.setItem(NAME_CONFIRMED_KEY, '1')
      onDone()
    } catch (e) {
      setError(e.message ?? 'Konnte den Namen nicht speichern.')
      setBusy(false)
    }
  }

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
      <div style={{ fontSize: 48 }}>👤</div>
      <div
        style={{
          color: '#673ab7',
          fontSize: 20,
          fontWeight: 'bold',
          letterSpacing: 3,
        }}
      >
        DEIN SPIELERNAME
      </div>
      <div
        style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: 13,
          textAlign: 'center',
          maxWidth: 320,
        }}
      >
        Trage dich im Spiel <b>genau so</b> ein — dann zählen die Spiele auf
        deine Statistik, auf jedem Gerät.
      </div>

      <input
        className="dialog-input"
        style={{ maxWidth: 340, textAlign: 'center', fontSize: 18 }}
        placeholder="z.B. Gedeon"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        autoFocus
      />

      <button
        className="btn-primary"
        style={{ width: '100%', maxWidth: 340 }}
        onClick={handleSave}
        disabled={busy}
      >
        {busy ? 'Speichere…' : 'Weiter →'}
      </button>

      {profile?.handle && (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          Dein Freund-Code: <b>{profile.handle}</b>
        </div>
      )}

      {error && (
        <div style={{ color: '#ff5252', fontSize: 13, textAlign: 'center' }}>
          {error}
        </div>
      )}
    </div>
  )
}
