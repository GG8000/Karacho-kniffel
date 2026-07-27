import { useMemo, useState } from 'react'
import {
  availableMonths,
  computeMonthlyRecap,
  monthLabel,
} from '../logic/monthlyRecap'

const MUTED = 'rgba(255,255,255,0.4)'

const MODE_LABEL = { normal: 'Normal', extrem: 'Extrem', lucky: 'Lucky' }

function NavButton({ disabled, onClick, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'none',
        border: 'none',
        color: disabled ? 'rgba(255,255,255,0.15)' : 'white',
        fontSize: 22,
        cursor: disabled ? 'default' : 'pointer',
        padding: '0 12px',
      }}
    >
      {children}
    </button>
  )
}

// Monatsrückblick: Navigation über die Monate mit Spielen, kurzer Textreport
// und die Tabelle aller Spieler dieses Monats.
export default function MonthlyRecapView({ games }) {
  const months = useMemo(() => availableMonths(games), [games])
  const [idx, setIdx] = useState(0) // 0 = neuester Monat

  const monthKey = months[idx]
  const recap = useMemo(
    () => (monthKey ? computeMonthlyRecap(games, monthKey) : null),
    [games, monthKey],
  )

  if (!months.length)
    return (
      <div style={{ color: MUTED, fontSize: 15, textAlign: 'center', padding: '32px 0' }}>
        📅 Noch keine Spiele für einen Rückblick.
      </div>
    )

  const modes = Object.entries(recap.byMode).filter(([, n]) => n > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Monatsnavigation — links älter, rechts neuer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <NavButton
          disabled={idx >= months.length - 1}
          onClick={() => setIdx((i) => Math.min(i + 1, months.length - 1))}
        >
          ‹
        </NavButton>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>
            {monthLabel(monthKey)}
          </div>
          <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
            {recap.gamesPlayed} {recap.gamesPlayed === 1 ? 'Spiel' : 'Spiele'}
            {modes.length > 1 &&
              ` · ${modes
                .map(([m, n]) => `${n}× ${MODE_LABEL[m] ?? m}`)
                .join(' · ')}`}
          </div>
        </div>
        <NavButton disabled={idx <= 0} onClick={() => setIdx((i) => Math.max(i - 1, 0))}>
          ›
        </NavButton>
      </div>

      {/* Kurzer Report */}
      <div
        style={{
          background: 'rgba(103,58,183,0.15)',
          border: '1px solid rgba(103,58,183,0.4)',
          borderRadius: 12,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
        }}
      >
        {recap.report.map((line, i) => (
          <div
            key={i}
            style={{
              color: i === 0 ? 'white' : 'rgba(255,255,255,0.75)',
              fontSize: i === 0 ? 15 : 13,
              fontWeight: i === 0 ? 'bold' : 'normal',
              lineHeight: 1.45,
            }}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Spieler des Monats */}
      {recap.players.length > 0 && (
        <div>
          <div
            style={{
              color: MUTED,
              fontSize: 12,
              letterSpacing: 2,
              marginBottom: 8,
            }}
          >
            SPIELER
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recap.players.map((p, i) => (
              <div
                key={p.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background:
                    i === 0 && p.wins > 0
                      ? 'rgba(103,58,183,0.2)'
                      : 'rgba(255,255,255,0.04)',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      color: 'white',
                      fontSize: 14,
                      fontWeight: 'bold',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {i === 0 && p.wins > 0 ? '👑 ' : ''}
                    {p.name}
                  </div>
                  <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                    {p.played} Sp · {p.wins} S
                    {p.avgScore != null && ` · Ø${p.avgScore}`}
                    {p.bestScore > 0 && ` · Best ${p.bestScore}`}
                    {p.kniffel > 0 && ` · 🎲${p.kniffel}`}
                  </div>
                </div>
                {p.delta != null && p.delta !== 0 && (
                  <div
                    title="Ø-Punkte gegenüber dem Vormonat (Normal-Modus)"
                    style={{
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: 'bold',
                      color: p.delta > 0 ? '#69ff47' : '#ff5252',
                    }}
                  >
                    {p.delta > 0 ? '▲' : '▼'} {Math.abs(p.delta)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ color: MUTED, fontSize: 11, lineHeight: 1.5 }}>
        Ø- und Bestleistung zählen nur Normal-Spiele — die Punktzahlen der
        anderen Modi sind damit nicht vergleichbar.
      </div>
    </div>
  )
}
