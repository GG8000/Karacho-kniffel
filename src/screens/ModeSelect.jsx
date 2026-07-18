import { useAuth } from '../auth/AuthContext'

export default function ModeSelect({ onSelect }) {
  const { isLoggedIn, profile } = useAuth()

  const modes = [
    {
      id: 'normal',
      label: 'NORMAL',
      icon: '🎲',
      desc: 'Klassisches Kniffel',
    },
    {
      id: 'lucky',
      label: 'LUCKY SCORE',
      icon: '🔮',
      desc: 'Tipp deinen Score — wer am nächsten dran ist gewinnt',
    },
    {
      id: 'extrem',
      label: 'KNIFFEL EXTREM',
      icon: '🔥',
      desc: 'Drei Blöcke gleichzeitig — von oben, von unten, normal',
    },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#1e1e1e',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: 24,
    }}>
      <div style={{ fontSize: 48 }}>🎲</div>
      <div style={{
        color: '#673ab7',
        fontSize: 26,
        fontWeight: 'bold',
        letterSpacing: 6,
        marginBottom: 8,
      }}>
        KNIFFEL
      </div>

      {modes.map(mode => (
        <button
          key={mode.id}
          onClick={() => onSelect(mode.id)}
          style={{
            width: '100%',
            maxWidth: 340,
            background: 'rgba(103,58,183,0.15)',
            border: '2px solid #673ab7',
            borderRadius: 14,
            padding: '18px 20px',
            color: 'white',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 'bold' }}>
            {mode.icon} {mode.label}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            {mode.desc}
          </div>
        </button>
      ))}

      {/* Online-Modus — braucht Anmeldung */}
      <button
        onClick={() => onSelect(isLoggedIn ? 'online' : 'profile')}
        style={{
          width: '100%',
          maxWidth: 340,
          background: 'rgba(103,58,183,0.15)',
          border: '2px solid #673ab7',
          borderRadius: 14,
          padding: '18px 20px',
          color: 'white',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 'bold' }}>🌐 ONLINE</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          {isLoggedIn
            ? 'Gegeneinander spielen, auch aus der Ferne — Tabelle live'
            : 'Zum Online-Spielen anmelden'}
        </div>
      </button>

      <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
        <button
          onClick={() => onSelect('stats')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            fontSize: 14,
            cursor: 'pointer',
            letterSpacing: 2,
          }}
        >
          📊 STATISTIKEN
        </button>
        <button
          onClick={() => onSelect('profile')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            fontSize: 14,
            cursor: 'pointer',
            letterSpacing: 2,
          }}
        >
          {isLoggedIn ? '👤 KONTO' : '🔐 EINLOGGEN'}
        </button>
      </div>

      {isLoggedIn && (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          Angemeldet als {profile?.display_name ?? '…'}
        </div>
      )}
    </div>
  )
}