import { useCallback, useEffect, useMemo, useState } from 'react'
import PlayerColumn from '../components/PlayerColumn'
import ScoreInputModal from '../components/ScoreInputModal'
import { useAuth } from '../auth/AuthContext'
import {
  CATEGORIES,
  isBoardComplete,
  isStruck,
  withTotals,
  nextCellState,
} from '../logic/kniffel'
import { celebrateKniffel } from '../lib/celebrate'
import { announceStrike } from '../lib/strike'
import { openGuide } from '../lib/guide'
import { calculateTotal } from '../logic/calculator'
import {
  fetchGame,
  subscribeGame,
  playTurn,
  setStatus,
} from '../lib/liveGame'
import { saveGame, toParticipants } from '../storage'
import { useRatingPreview } from '../lib/useRatingPreview'
import RatingDelta from '../components/RatingDelta'
import Spinner from '../components/Spinner'

export default function OnlineGame({ gameId, onExit }) {
  const { profile } = useAuth()
  const meId = profile?.id
  const [game, setGame] = useState(null)
  const [players, setPlayers] = useState([])
  const [scores, setScores] = useState([])
  const [modal, setModal] = useState(null)
  // Der vorgemerkte Zug: { cIdx, entry }. Durchgeklickt wird rein lokal, erst
  // "Zug bestätigen" schickt genau EINEN playTurn() los — die RPC schreibt eine
  // Zelle einmalig und schaltet den Zug weiter, ein Tap pro Klick würde sie
  // beim zweiten Mal ablehnen.
  const [pending, setPending] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    fetchGame(gameId)
      .then(({ game, players, scores }) => {
        setGame(game)
        setPlayers(players)
        setScores(scores)
      })
      .catch((e) => setError(e.message ?? 'Fehler beim Laden.'))
  }, [gameId])

  useEffect(() => {
    load()
    const unsubscribe = subscribeGame(gameId, load)
    return unsubscribe
  }, [gameId, load])

  // Wechselt der Zug, ist ein noch vorgemerkter Eintrag hinfällig — sonst
  // stünde er beim nächsten eigenen Zug in der falschen Zelle.
  useEffect(() => {
    setPending(null)
  }, [game?.current_turn])

  // Zellen nach Spieler gruppieren
  const scoresByPlayer = {}
  for (const s of scores) {
    ;(scoresByPlayer[s.profile_id] ??= {})[s.category_index] = {
      value: s.value,
      isKniffel: s.is_kniffel,
    }
  }

  const isHost = game && meId === game.host_id
  const playing = game?.status === 'playing'
  const mySeat = players.find((p) => p.profileId === meId)?.seat
  const currentPlayer = players.find((p) => p.seat === game?.current_turn)
  const isMyTurn = playing && mySeat != null && mySeat === game?.current_turn
  const complete = isBoardComplete(
    players.map((p) => p.profileId),
    scoresByPlayer,
  )

  // Die eigene Spalte zeigt den vorgemerkten Zug schon mit — inklusive SUMME
  // und TOTAL, damit man sieht, was der Eintrag bringt.
  function columnScores(profileId) {
    const own = scoresByPlayer[profileId] || {}
    if (profileId !== meId || !pending) return withTotals(own)
    return withTotals({ ...own, [pending.cIdx]: pending.entry })
  }

  // Sheet-Kategorien (3er/4er/CHNC, Kniffel) merken den Wert nur vor — abgeschickt
  // wird wie beim Durchklicken erst mit "Zug bestätigen".
  function handleSave(val, isKniffel, face = null) {
    setPending({
      cIdx: modal.cIdx,
      // fromSheet: dort hat das Sheet eine Streichung schon gemeldet, genau wie
      // es die Kniffel-Feier schon abgefeuert hat — confirmTurn darf sie nicht
      // ein zweites Mal zeigen.
      fromSheet: true,
      entry: { value: val, timestamp: Date.now(), isKniffel, face },
    })
    setModal(null)
  }

  // Tap auf eine Zelle: oberer Teil und feste Punktzahlen klicken durch, der
  // Rest öffnet das Sheet. Alles bleibt lokal, bis bestätigt wird.
  function handleTap(cIdx) {
    if (!isMyTurn) return
    if (scoresByPlayer[meId]?.[cIdx]) return // schon abgeschickt
    const step = nextCellState(cIdx, pending?.cIdx === cIdx ? pending.entry : undefined)
    if (!step) return
    if (step.kind === 'sheet') {
      setModal({ cIdx })
      return
    }
    // Weder Feier noch Streich-Animation hier: der Zug ist nur vorgemerkt und
    // bis "Zug bestätigen" jederzeit umtippbar. Beides feuert in confirmTurn().
    setPending(step.kind === 'set' ? { cIdx, entry: step.entry } : null)
  }

  async function confirmTurn() {
    if (!pending || submitting) return
    setSubmitting(true)
    try {
      await playTurn(
        gameId,
        pending.cIdx,
        pending.entry.value,
        pending.entry.isKniffel,
      )
      // Erst jetzt ist der Zug wirklich passiert — anders als lokal, wo der Tap
      // ihn schon setzt. Deshalb hier statt in handleTap, und ohne Bedenkzeit:
      // das Bestätigen IST die Entscheidung.
      //
      // fromSheet-Einträge haben ihre Meldung schon im Sheet abgesetzt.
      if (!pending.fromSheet) {
        if (pending.entry.isKniffel) {
          celebrateKniffel({ kind: 'upper', face: pending.entry.face })
        } else if (isStruck(pending.cIdx, pending.entry)) {
          announceStrike({
            cIdx: pending.cIdx,
            category: CATEGORIES[pending.cIdx],
            playerName: players.find((p) => p.profileId === meId)?.name,
          })
        }
      }
      setPending(null)
      load()
    } catch (e) {
      setError(e.message ?? 'Zug nicht möglich.')
    } finally {
      setSubmitting(false)
    }
  }

  // Eine Quelle für das Speichern (Host) UND die Rating-Vorschau, die alle
  // Beteiligten auf dem Ergebnis-Screen sehen.
  function buildGamePayload() {
    const totals = players.map((p) =>
      calculateTotal(scoresByPlayer[p.profileId] || {}),
    )
    const max = Math.max(...totals)
    return {
      mode: 'normal',
      players: players.map((p) => p.name),
      identities: players.map((p) => p.profileId),
      finalScores: totals,
      isWinners: totals.map((t) => t === max),
      kniffelCounts: players.map(
        (p) =>
          Object.values(scoresByPlayer[p.profileId] || {}).filter(
            (e) => e.isKniffel,
          ).length,
      ),
    }
  }

  // Host wertet aus: Endergebnis in die Statistik schreiben + Status 'done'
  async function handleEvaluate() {
    setSaving(true)
    try {
      await saveGame(buildGamePayload())
      await setStatus(gameId, 'done')
    } catch (e) {
      setError(e.message ?? 'Auswerten fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  // Vorschau aufs Rating für den Ergebnis-Screen. Der Hook steht vor der Kette
  // früher Returns — Hooks müssen in jedem Render laufen.
  //
  // alreadySaved: anders als in den lokalen Modi ist das Spiel hier schon
  // geschrieben, wenn dieser Screen erscheint (der Host speichert in
  // handleEvaluate). Der Hook rechnet es für den Vorher-Stand wieder heraus.
  const resultParticipants = useMemo(
    () =>
      game?.status === 'done' ? toParticipants(buildGamePayload()) : [],
    // Absichtlich die EINGABEN von buildGamePayload() als Abhängigkeiten und
    // nicht die Funktion selbst — die wird bei jedem Render neu angelegt.
    [game?.status, players, scores],
  )
  const { rows: ratingRows } = useRatingPreview(resultParticipants, {
    active: game?.status === 'done',
    alreadySaved: true,
  })

  if (!game) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#1e1e1e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        {error ? (
          <span style={{ color: '#ff5252', fontSize: 13 }}>{error}</span>
        ) : (
          <Spinner label="Lade Spiel…" />
        )}
      </div>
    )
  }

  // Ergebnis-Screen
  if (game.status === 'done') {
    // Index mitführen: die Liste wird nach Punkten sortiert, die Rating-Zeilen
    // liegen aber in der Reihenfolge von players.
    const results = players
      .map((p, pIdx) => ({
        name: p.name,
        pIdx,
        total: calculateTotal(scoresByPlayer[p.profileId] || {}),
      }))
      .sort((a, b) => b.total - a.total)

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
        <div style={{ fontSize: 48 }}>🏆</div>
        <div
          style={{
            color: '#673ab7',
            fontWeight: 'bold',
            fontSize: 22,
            letterSpacing: 3,
          }}
        >
          AUSWERTUNG
        </div>
        {results.map((r, i) => (
          <div
            key={i}
            style={{
              width: '100%',
              maxWidth: 340,
              background:
                i === 0 ? 'rgba(103,58,183,0.3)' : 'rgba(255,255,255,0.05)',
              border:
                i === 0
                  ? '2px solid #673ab7'
                  : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ color: 'white', fontWeight: 'bold' }}>
                {i === 0 ? '🏆 ' : i === 1 ? '🥈 ' : '🥉 '}
                {r.name}
              </div>
              <div
                style={{ color: '#673ab7', fontWeight: 'bold', fontSize: 18 }}
              >
                {r.total}
              </div>
            </div>
            {ratingRows[r.pIdx] && (
              <RatingDelta {...ratingRows[r.pIdx]} index={i} />
            )}
          </div>
        ))}
        <button
          className="btn-primary"
          style={{ marginTop: 8 }}
          onClick={onExit}
        >
          Zum Menü →
        </button>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="app-bar" style={{ fontSize: 15 }}>
        <button
          onClick={onExit}
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
        🌐 ONLINE
        <button
          onClick={openGuide}
          aria-label='Anleitung'
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.75)',
            fontSize: 17,
            cursor: 'pointer',
            width: 40,
          }}
        >
          ?
        </button>
      </div>

      {playing && currentPlayer && (
        <div
          style={{
            flexShrink: 0,
            padding: '8px 12px',
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 'bold',
            background: isMyTurn
              ? 'rgba(105,255,71,0.15)'
              : 'rgba(103,58,183,0.18)',
            color: isMyTurn ? '#69ff47' : '#b39ddb',
          }}
        >
          {submitting ? (
            <Spinner row label="Zug wird übertragen…" size={14} />
          ) : isMyTurn ? (
            '▶ Du bist dran — wähle eine Kategorie'
          ) : (
            `⏳ ${currentPlayer.name} ist dran…`
          )}
        </div>
      )}

      <div className="game-area">
        <div className="categories-column">
          <div className="cat-header">KAT</div>
          {CATEGORIES.map((cat, i) => (
            <div key={i} className="cat-cell">
              {cat}
            </div>
          ))}
        </div>

        <div className="players-area">
          {players.map((p) => (
            <PlayerColumn
              key={p.profileId}
              pIdx={p.profileId}
              name={p.profileId === meId ? `${p.name} (du)` : p.name}
              categories={CATEGORIES}
              playerScores={columnScores(p.profileId)}
              canEdit={isMyTurn && p.profileId === meId}
              pendingCIdx={p.profileId === meId ? (pending?.cIdx ?? null) : null}
              onTap={(_, cIdx) => handleTap(cIdx)}
            />
          ))}
        </div>
      </div>

      <div className="footer">
        {/* Solange ein Zug vorgemerkt ist, hat er Vorrang — er ist das
            Einzige, was gerade zu tun ist. */}
        {pending ? (
          <>
            <button
              className="btn-danger"
              onClick={() => setPending(null)}
              disabled={submitting}
            >
              Verwerfen
            </button>
            <button
              className="btn-primary"
              onClick={confirmTurn}
              disabled={submitting}
            >
              {submitting ? (
                <Spinner row label="Sende…" size={16} />
              ) : (
                'ZUG BESTÄTIGEN ✓'
              )}
            </button>
          </>
        ) : (
          <>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
              {isHost
                ? complete
                  ? 'Alle fertig — auswerten!'
                  : 'Reihum eintragen…'
                : 'Der Host wertet am Ende aus.'}
            </div>
            {isHost && (
              <button
                className="btn-primary"
                onClick={handleEvaluate}
                disabled={saving}
                style={{ opacity: complete ? 1 : 0.6 }}
              >
                {saving ? (
                  <Spinner row label="Speichere…" size={16} />
                ) : (
                  'AUSWERTEN →'
                )}
              </button>
            )}
          </>
        )}
      </div>

      {error && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: 0,
            right: 0,
            textAlign: 'center',
            color: '#ff5252',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {modal && (
        <ScoreInputModal
          pIdx={meId}
          cIdx={modal.cIdx}
          categories={CATEGORIES}
          playerName={players.find((p) => p.profileId === meId)?.name}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={() => setModal(null)}
        />
      )}
    </div>
  )
}
