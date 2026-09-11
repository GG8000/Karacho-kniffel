import { getHistory, clearHistory } from '../storage'
import { useAuth } from '../auth/AuthContext'
import { useEffect, useMemo, useState } from 'react'
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
  de0,
} from '../components/StatCharts'
import MonthlyRecapView from '../components/MonthlyRecapView'
import CityMap from '../components/CityMap'
import { fetchCityStats } from '../lib/cityStats'
import { applyStatRules, nameByKey } from '../logic/applyStatRules'
import {
  EMPTY_RULES,
  clearRule,
  hidePlayer,
  loadStatRules,
  mergePlayer,
} from '../lib/statRules'
import Spinner from '../components/Spinner'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Statistics({ onBack }) {
  const { isLoggedIn } = useAuth()
  // history ist die ROHE Historie; die Regeln legen sich erst darüber.
  const [history, setHistory] = useState(null)
  const [rules, setRules] = useState(EMPTY_RULES)
  const [selected, setSelected] = useState(null)
  // leaderboard | players | month | cities
  const [tab, setTab] = useState('leaderboard')
  const [clearDialog, setClearDialog] = useState(false)
  const [cities, setCities] = useState(null)
  // Spieler verwalten: zusammenlegen / ausblenden
  const [manage, setManage] = useState(false)
  const [mergeFrom, setMergeFrom] = useState(null)
  const [hideKey, setHideKey] = useState(null)
  const [ruleError, setRuleError] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getHistory(), loadStatRules()])
      .then(([h, r]) => {
        if (cancelled) return
        setHistory(h)
        setRules(r)
      })
      .catch(() => {
        if (!cancelled) setHistory([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Alle Auswertungen hängen an derselben, bereits gefilterten Liste — so wirken
  // die Regeln überall gleich, ohne dass ein Aggregator davon wissen muss.
  const games = useMemo(
    () => applyStatRules(history ?? [], rules),
    [history, rules],
  )
  const stats = useMemo(() => computeStats(games), [games])
  const catStats = useMemo(() => computeCategoryStats(games), [games])
  const orderStats = useMemo(() => computeOrderStats(games), [games])
  const faceStats = useMemo(() => computeKniffelFaces(games), [games])
  // Namen für die Regel-Liste aus der ROHEN Historie: Ausgeblendete stehen in
  // stats ja gerade nicht mehr drin.
  const allNames = useMemo(() => nameByKey(history ?? []), [history])

  async function runRule(fn) {
    setRuleError(null)
    try {
      setRules(await fn())
    } catch (e) {
      setRuleError(e?.message ?? 'Regel konnte nicht gespeichert werden.')
    }
  }

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

  if (history === null)
    return shell(<Spinner label="Lade Statistiken…" />)

  const players = Object.values(stats)
  const selectedPlayer = selected ? stats[selected] : null
  const ranked = [...players].sort((a, b) => b.rating - a.rating)

  // Regeln zum Anzeigen und Zurücknehmen.
  const ruleEntries = [
    ...Object.entries(rules.merges).map(([key, target]) => ({
      key,
      target,
      kind: 'merge',
    })),
    ...rules.hidden.map((key) => ({ key, kind: 'hidden' })),
  ]
  const labelFor = (key) => allNames.get(key) ?? key.replace(/^[pg]:/, '')

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
              ['➕ Punkte gesamt', de0(selectedPlayer.sumScore)],
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
          <MonthlyRecapView games={games} />
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: 'rgba(255,255,255,0.35)',
                fontSize: 12,
              }}
            >
              <span style={{ flex: 1 }}>
                {isLoggedIn
                  ? '☁ = geräteübergreifend · Freund-Code unter 👤 Konto'
                  : 'Nicht angemeldet — Statistiken nur auf diesem Gerät.'}
              </span>
              {(players.length > 0 || ruleEntries.length > 0) && (
                <button
                  onClick={() => {
                    setManage((m) => !m)
                    setRuleError(null)
                  }}
                  style={{
                    background: manage ? '#673ab7' : 'rgba(255,255,255,0.06)',
                    border: 'none',
                    borderRadius: 8,
                    color: manage ? 'white' : 'rgba(255,255,255,0.5)',
                    fontSize: 11,
                    fontWeight: 'bold',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {manage ? 'Fertig' : '⚙ Verwalten'}
                </button>
              )}
            </div>

            {manage && (
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                Zusammenlegen führt zwei Namen zu einem Spieler zusammen,
                Entfernen nimmt einen ganz aus der Auswertung. Beides betrifft
                nur die Statistik — die Spiele selbst bleiben erhalten, und
                zurücknehmen kannst du es jederzeit.
              </div>
            )}

            {ruleError && (
              <div style={{ color: '#ff8a80', fontSize: 13 }}>{ruleError}</div>
            )}

            {players.map((p) => (
              <div
                key={p.id}
                onClick={manage ? undefined : () => setSelected(p.id)}
                style={{
                  background: 'rgba(103,58,183,0.15)',
                  border: '1px solid rgba(103,58,183,0.4)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  color: 'white',
                  cursor: manage ? 'default' : 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
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
                {manage ? (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        setRuleError(null)
                        setMergeFrom(p.id)
                      }}
                      disabled={players.length < 2}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: 'none',
                        borderRadius: 8,
                        color: 'white',
                        fontSize: 11,
                        padding: '8px 10px',
                        cursor: players.length < 2 ? 'default' : 'pointer',
                        opacity: players.length < 2 ? 0.4 : 1,
                      }}
                    >
                      ⇄ Zusammenlegen
                    </button>
                    <button
                      onClick={() => {
                        setRuleError(null)
                        setHideKey(p.id)
                      }}
                      style={{
                        background: 'rgba(255,82,82,0.15)',
                        border: 'none',
                        borderRadius: 8,
                        color: '#ff8a80',
                        fontSize: 11,
                        padding: '8px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      ✕ Entfernen
                    </button>
                  </div>
                ) : (
                  <div style={{ color: '#673ab7', fontSize: 20 }}>›</div>
                )}
              </div>
            ))}

            {ruleEntries.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 12,
                    letterSpacing: 2,
                    marginBottom: 8,
                  }}
                >
                  REGELN
                </div>
                {ruleEntries.map((r) => (
                  <div
                    key={r.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      borderBottom: '1px solid rgba(255,255,255,0.07)',
                      padding: '9px 0',
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.75)',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {r.kind === 'merge' ? (
                        <>
                          <b>{labelFor(r.key)}</b> zählt zu{' '}
                          <b>{labelFor(r.target)}</b>
                        </>
                      ) : (
                        <>
                          <b>{labelFor(r.key)}</b> ist aus der Auswertung
                          entfernt
                        </>
                      )}
                    </span>
                    <button
                      onClick={() => runRule(() => clearRule(r.key))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#b388ff',
                        fontSize: 12,
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Rückgängig
                    </button>
                  </div>
                ))}
              </div>
            )}

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

      {/* Ziel für das Zusammenlegen wählen */}
      {mergeFrom && (
        <div className="dialog-overlay">
          <div className="dialog">
            <div className="dialog-title">
              {labelFor(mergeFrom)} zählt künftig zu …
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              Alle Spiele von {labelFor(mergeFrom)} werden dem gewählten Spieler
              zugerechnet. Rückgängig machen kannst du das jederzeit.
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: '40vh',
                overflowY: 'auto',
                margin: '4px 0',
              }}
            >
              {players
                .filter((t) => t.id !== mergeFrom)
                .map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      const from = mergeFrom
                      setMergeFrom(null)
                      runRule(() => mergePlayer(from, t.id, rules))
                    }}
                    style={{
                      background: 'rgba(103,58,183,0.15)',
                      border: '1px solid rgba(103,58,183,0.4)',
                      borderRadius: 10,
                      padding: '11px 14px',
                      color: 'white',
                      fontSize: 15,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    {t.name} {t.isAccount && '☁'}
                    <span
                      style={{
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: 12,
                      }}
                    >
                      {' '}
                      · {t.gamesPlayed} Spiele
                    </span>
                  </button>
                ))}
            </div>
            <div className="dialog-actions">
              <button className="btn-outline" onClick={() => setMergeFrom(null)}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aus der Auswertung nehmen */}
      {hideKey && (
        <div className="dialog-overlay">
          <div className="dialog">
            <div className="dialog-title">
              {labelFor(hideKey)} aus der Statistik nehmen?
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              Der Spieler verschwindet aus Rangliste, Head-to-Head und
              Monatsrückblick, und die betroffenen Spiele werden gewertet, als
              hätte er nie mitgespielt. Die Spiele selbst bleiben erhalten — du
              kannst das jederzeit zurücknehmen.
            </div>
            <div className="dialog-actions">
              <button className="btn-outline" onClick={() => setHideKey(null)}>
                Abbrechen
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  const key = hideKey
                  setHideKey(null)
                  runRule(() => hidePlayer(key))
                }}
              >
                Entfernen
              </button>
            </div>
          </div>
        </div>
      )}

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
