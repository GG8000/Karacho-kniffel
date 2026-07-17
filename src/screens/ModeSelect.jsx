import { useAuth } from '../auth/AuthContext'

export default function ModeSelect({ onSelect }) {
  const { isLoggedIn, profile, exitGuest } = useAuth()

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

      <button
        onClick={() => onSelect('stats')}
        style={{
          marginTop: 8,
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

      {isLoggedIn ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          Angemeldet als {profile?.display_name ?? '…'}
        </div>
      ) : (
        <button
          onClick={exitGuest}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 8,
            padding: '8px 16px',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          🔐 Anmelden
        </button>
      )}
    </div>
  )
}