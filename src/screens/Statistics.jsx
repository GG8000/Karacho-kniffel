import { getHistory, clearHistory } from '../storage'
import { useAuth } from '../auth/AuthContext'
import { useEffect, useState } from 'react'
import { computeStats } from '../logic/stats'
import { computeCategoryStats } from '../logic/categoryStats'
import { computeOrderStats } from '../logic/orderStats'
import { computeKniffelFaces } from '../logic/kniffelFaces'
import {
  ScoreLineChart,
  Histogram,
  FormStrip,
  HeadToHeadMatrix,
  CategoryStatsView,
  OrderStatsView,
  KniffelFaceView,
} from '../components/StatCharts'
import MonthlyRecapView from '../components/MonthlyRecapView'
import CityMap from '../components/CityMap'
import { fetchCityStats } from '../lib/cityStats'
import Spinner from '../components/Spinner'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Statistics({ onBack }) {
  const { isLoggedIn } = useAuth()
  const [stats, setStats] = useState(null)
  const [catStats, setCatStats] = useState({})
  const [orderStats, setOrderStats] = useState({})
  const [faceStats, setFaceStats] = useState({})
  const [history, setHistory] = useState([])
  const [selected, setSelected] = useState(null)
  // leaderboard | players | month | cities
  const [tab, setTab] = useState('leaderboard')
  const [clearDialog, setClearDialog] = useState(false)
  const [cities, setCities] = useState(null)

  useEffect(() => {
    let cancelled = false
    getHistory()
      .then((h) => {
        if (cancelled) return
        setHistory(h)
        setStats(computeStats(h))
        setCatStats(computeCategoryStats(h))
        setOrderStats(computeOrderStats(h))
        setFaceStats(computeKniffelFaces(h))
      })
      .catch(() => {
        if (!cancelled) setStats({})
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Städte-Daten haben nichts mit der Spielhistorie zu tun und laufen deshalb in
  // einem eigenen Effect — sie sollen deren Ladepfad nicht ausbremsen.
  useEffect(() => {
    let cancelled = false
    fetchCityStats()
      .then((rows) => {
        if (!cancelled) setCities(rows)
      })
      .catch(() => {
        if (!cancelled) setCities([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const shell = (children) => (
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
      {children}
    </div>
  )

  if (stats === null)
    return shell(<Spinner label="Lade Statistiken…" />)

  const players = Object.values(stats)
  const selectedPlayer = selected ? stats[selected] : null
  const ranked = [...players].sort((a, b) => b.rating - a.rating)

  const section = (title, node) => (
    <div style={{ marginTop: 4 }}>
      <div
        style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: 12,
          letterSpacing: 2,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {node}
    </div>
  )

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#1e1e1e',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div className="app-bar">
        <button
          onClick={selected ? () => setSelected(null) : onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: 18,
            cursor: 'pointer',
            padding: '0 8px',
          }}
        >
          ←
        </button>
        📊 STATISTIKEN
        <div style={{ width: 40 }} />
      </div>

      {/* Tabs (nur in der Übersicht) */}
      {!selectedPlayer && (
        <div style={{ display: 'flex', padding: '10px 16px 0', gap: 8 }}>
          {[
            ['leaderboard', '🏆 Rangliste'],
            ['players', 'Spieler'],
            ['month', '📅 Monat'],
            ['cities', '🗺️ Städte'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                // Bei vier Tabs wird die Zeile am Handy eng.
                padding: '8px 2px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 'bold',
                background: tab === id ? '#673ab7' : 'rgba(255,255,255,0.06)',
                color: tab === id ? 'white' : 'rgba(255,255,255,0.5)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {players.length === 0 && tab !== 'month' && tab !== 'cities' && (
          <div
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 15,
              textAlign: 'center',
              padding: '32px 0',
            }}
          >
            📊 Noch keine Spiele gespeichert.
          </div>
        )}

        {selectedPlayer ? (
          // ---- Detail mit Diagrammen ----
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div
                style={{ color: '#673ab7', fontWeight: 'bold', fontSize: 22 }}
              >
                {selectedPlayer.name}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{ color: '#b39ddb', fontWeight: 'bold', fontSize: 22 }}
                >
                  {selectedPlayer.rating}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
                  RATING
                </div>
              </div>
            </div>

            {[
              ['🎮 Spiele', selectedPlayer.gamesPlayed],
              ['🏆 Siege', selectedPlayer.wins],
              ['📉 Niederlagen', selectedPlayer.losses],
              [
                '📈 Siegrate',
                `${Math.round(selectedPlayer.winRate * 100)}%`,
              ],
              ['🎯 Ø Punkte', selectedPlayer.avgScore],
              ['🥇 Bestleistung', selectedPlayer.bestScore],
              ['🎲 Kniffel gesamt', selectedPlayer.totalKniffel],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  padding: '9px 0',
                  color: 'white',
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
                <span style={{ fontWeight: 'bold' }}>{value}</span>
              </div>
            ))}

            {section(
              'SCORE-VERLAUF',
              <ScoreLineChart history={selectedPlayer.scoreHistory} />,
            )}
            {section('FORM', <FormStrip form={selectedPlayer.form} />)}
            {section(
              'ENDPUNKTE-VERTEILUNG',
              <Histogram
                scores={selectedPlayer.scoreHistory.map((h) => h.score)}
              />,
            )}
            {section(
              'HEAD-TO-HEAD',
              <HeadToHeadMatrix opponents={selectedPlayer.opponents} />,
            )}
            {section(
              'KATEGORIEN',
              <CategoryStatsView stat={catStats[selected]} />,
            )}
            {section(
              'REIHENFOLGE',
              <OrderStatsView stat={orderStats[selected]} />,
            )}
            {section(
              'KNIFFEL-WÜRFEL',
              <KniffelFaceView stat={faceStats[selected]} />,
            )}
          </>
        ) : tab === 'month' ? (
          <MonthlyRecapView games={history} />
        ) : tab === 'cities' ? (
          // ---- Städte ----
          <>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
              Woher gekniffelt wird — ohne Namen und ohne Konto-Bezug. Abschalten
              unter 👤 Konto.
            </div>
            {cities === null ? (
              <Spinner label="Lade Städte…" />
            ) : (
              <CityMap cities={cities} />
            )}
          </>
        ) : tab === 'leaderboard' ? (
          // ---- Rangliste ----
          <>
            {faceStats.__global?.total > 0 && (
              <div
                style={{
                  background: 'rgba(103,58,183,0.15)',
                  border: '1px solid rgba(103,58,183,0.4)',
                  borderRadius: 12,
                  padding: '14px 16px',
                }}
              >
                <div
                  style={{
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 12,
                    letterSpacing: 2,
                    marginBottom: 10,
                  }}
                >
                  HÄUFIGSTER KNIFFEL
                </div>
                <KniffelFaceView stat={faceStats.__global} />
              </div>
            )}

            {players.length > 0 && (
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                Rating aus euren gemeinsamen Spielen{' '}
                {isLoggedIn ? '· ☁ = Account' : ''}
              </div>
            )}
            {ranked.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                style={{
                  background:
                    i === 0 ? 'rgba(103,58,183,0.28)' : 'rgba(103,58,183,0.12)',
                  border:
                    i === 0
                      ? '1px solid #673ab7'
                      : '1px solid rgba(103,58,183,0.3)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    width: 24,
                    fontSize: 16,
                    fontWeight: 'bold',
                    color: 'rgba(255,255,255,0.6)',
                    textAlign: 'center',
                  }}
                >
                  {MEDALS[i] ?? i + 1}
                </span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 'bold', fontSize: 15 }}>
                    {p.name} {p.isAccount && <span title="Account">☁</span>}
                  </div>
                  <div
                    style={{
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    {p.gamesPlayed} Sp · {p.wins} S ·{' '}
                    {Math.round(p.winRate * 100)}% · Ø{p.avgScore}
                  </div>
                </div>
                <div
                  style={{ color: '#b39ddb', fontWeight: 'bold', fontSize: 18 }}
                >
                  {p.rating}
                </div>
              </button>
            ))}
          </>
        ) : (
          // ---- Spielerliste ----
          <>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
              {isLoggedIn
                ? '☁ = geräteübergreifend · Freund-Code unter 👤 Konto'
                : 'Nicht angemeldet — Statistiken nur auf diesem Gerät.'}
            </div>
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                style={{
                  background: 'rgba(103,58,183,0.15)',
                  border: '1px solid rgba(103,58,183,0.4)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                    {p.name}{' '}
                    {p.isAccount && <span title="geräteübergreifend">☁</span>}
                  </div>
                  <div
                    style={{
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    {p.gamesPlayed} Spiele · {p.wins} Siege
                  </div>
                </div>
                <div style={{ color: '#673ab7', fontSize: 20 }}>›</div>
              </button>
            ))}
            {players.length > 0 && (
              <button
                onClick={() => setClearDialog(true)}
                style={{
                  marginTop: 8,
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,100,100,0.5)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Lokalen Verlauf löschen
              </button>
            )}
          </>
        )}
      </div>

      {clearDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <div className="dialog-title">Lokalen Verlauf löschen?</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              Löscht nur den Zwischenspeicher auf diesem Gerät. Bereits
              synchronisierte Spiele bleiben in der Cloud.
            </div>
            <div className="dialog-actions">
              <button
                className="btn-outline"
                onClick={() => setClearDialog(false)}
              >
                Abbrechen
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  clearHistory()
                  setClearDialog(false)
                  onBack()
                }}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
