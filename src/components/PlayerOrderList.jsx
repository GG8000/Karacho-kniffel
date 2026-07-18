import { useEffect, useState } from 'react'

// Reihenfolge der Spieler per Hoch/Runter-Pfeilen (rechts am Namen).
// Nur der Host kann ordnen (canReorder); onCommit(orderedProfileIds) bei jeder Änderung.
export default function PlayerOrderList({
  players,
  canReorder,
  hostId,
  meId,
  onCommit,
}) {
  // Optimistisch lokal, wird von der Server-Reihenfolge nachgezogen
  const [order, setOrder] = useState(players)
  useEffect(() => setOrder(players), [players])

  function move(idx, dir) {
    const target = idx + dir
    if (target < 0 || target >= order.length) return
    const next = [...order]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setOrder(next)
    onCommit(next.map((p) => p.profileId))
  }

  const arrowStyle = (disabled) => ({
    background: 'rgba(255,255,255,0.08)',
    border: 'none',
    borderRadius: 6,
    color: disabled ? 'rgba(255,255,255,0.2)' : '#b39ddb',
    fontSize: 16,
    width: 32,
    height: 32,
    cursor: disabled ? 'default' : 'pointer',
    lineHeight: 1,
  })

  return (
    <div style={{ width: '100%' }}>
      {order.map((p, idx) => (
        <div
          key={p.profileId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'white',
            background: 'rgba(103,58,183,0.15)',
            borderRadius: 10,
            padding: '8px 10px 8px 14px',
            marginBottom: 6,
          }}
        >
          <span style={{ color: '#b39ddb', fontWeight: 'bold', width: 16 }}>
            {idx + 1}
          </span>
          <span style={{ flex: 1 }}>
            {p.name}
            {p.profileId === hostId && ' · Host'}
            {p.profileId === meId && ' · du'}
          </span>
          {canReorder && (
            <span style={{ display: 'flex', gap: 4 }}>
              <button
                style={arrowStyle(idx === 0)}
                disabled={idx === 0}
                onClick={() => move(idx, -1)}
                aria-label="nach oben"
              >
                ▲
              </button>
              <button
                style={arrowStyle(idx === order.length - 1)}
                disabled={idx === order.length - 1}
                onClick={() => move(idx, 1)}
                aria-label="nach unten"
              >
                ▼
              </button>
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
