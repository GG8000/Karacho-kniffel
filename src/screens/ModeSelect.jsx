import { useAuth } from '../auth/AuthContext'
import { Planet, Rocket } from '../components/SpaceArt'

export default function ModeSelect({ onSelect }) {
  const { isLoggedIn, profile } = useAuth()

  // accent färbt Schein und Umriss-Zahl der Karte (siehe .mode-card in App.css).
  const modes = [
    {
      id: 'normal',
      label: 'NORMAL',
      icon: '🎲',
      desc: 'Klassisches Kniffel',
      accent: 'var(--accent-cyan)',
    },
    {
      id: 'lucky',
      label: 'LUCKY SCORE',
      icon: '🔮',
      desc: 'Tipp deinen Score — wer am nächsten dran ist gewinnt',
      accent: 'var(--accent-pink)',
    },
    {
      id: 'extrem',
      label: 'KNIFFEL EXTREM',
      icon: '🔥',
      desc: 'Drei Blöcke gleichzeitig — von oben, von unten, normal',
      accent: 'var(--accent-orange)',
    },
  ]

  // Online-Modus — braucht Anmeldung
  const online = {
    id: isLoggedIn ? 'online' : 'profile',
    label: 'ONLINE',
    icon: '🌐',
    desc: isLoggedIn
      ? 'Gegeneinander spielen, auch aus der Ferne — Tabelle live'
      : 'Zum Online-Spielen anmelden',
    accent: 'var(--accent-green)',
  }

  const cards = [...modes, online]

  return (
    <div className="home">
      <div className="home-inner">
        <div className="home-hero reveal" style={{ '--i': 0 }}>
          <div className="home-art">
            <Planet />
            <div className="home-rocket">
              <Rocket />
            </div>
          </div>
          <div className="home-title">KNIFFEL</div>
        </div>

        {cards.map((mode, i) => (
          <button
            key={mode.label}
            className="mode-card reveal"
            style={{ '--accent': mode.accent, '--i': i + 1 }}
            onClick={() => onSelect(mode.id)}
          >
            <span className="mode-num" aria-hidden="true">{i + 1}</span>
            <span className="mode-icon">{mode.icon}</span>
            <span className="mode-text">
              <span className="mode-label">{mode.label}</span>
              <span className="mode-desc">{mode.desc}</span>
            </span>
            <span className="mode-go" aria-hidden="true">→</span>
          </button>
        ))}

        <div className="home-links reveal" style={{ '--i': cards.length + 1 }}>
          <button className="home-link" onClick={() => onSelect('stats')}>
            📊 STATISTIKEN
          </button>
          <button className="home-link" onClick={() => onSelect('strategy')}>
            🧠 STRATEGIE
          </button>
          <button className="home-link" onClick={() => onSelect('profile')}>
            {isLoggedIn ? '👤 KONTO' : '🔐 EINLOGGEN'}
          </button>
        </div>

        {isLoggedIn && (
          <div
            className="reveal"
            style={{
              '--i': cards.length + 2,
              color: 'var(--text-faint)',
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            Angemeldet als {profile?.display_name ?? '…'}
          </div>
        )}
      </div>
    </div>
  )
}
