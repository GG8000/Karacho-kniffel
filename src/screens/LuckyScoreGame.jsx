import { useState, useRef, useMemo } from "react";
import PlayerColumn from "../components/PlayerColumn";
import ScoreInputModal from "../components/ScoreInputModal";
import FriendCodeDialog from "../components/FriendCodeDialog";
import PlayerLinkButtons from "../components/PlayerLinkButtons";
import RecentPlayersPicker from "../components/RecentPlayersPicker";
import { useAuth } from "../auth/AuthContext";
import { finalizeIdentities } from "../auth/identity";
import { calculateUpperBalance, calculateTotal } from "../logic/calculator";
import { CATEGORIES, isStruck, nextCellState } from "../logic/kniffel";
import { armKniffel } from "../lib/celebrate";
import { armStrike } from "../lib/strike";
import { cancelCellEvent } from "../lib/pendingCell";
import { showToast } from "../lib/toast";
import { openGuide } from "../lib/guide";
import { useArmedCell } from "../lib/useArmedCell";
import { saveGame, toParticipants } from "../storage";
import { useRatingPreview } from "../lib/useRatingPreview";
import RatingDelta from "../components/RatingDelta";

function refreshTotals(playerScores) {
  const now = Date.now();
  return {
    ...playerScores,
    6: { value: calculateUpperBalance(playerScores), timestamp: now },
    14: { value: calculateTotal(playerScores), timestamp: now },
  };
}

export default function LuckyScoreGame({ onExit }) {
  const { profile } = useAuth();
  const [phase, setPhase] = useState("setup"); // setup | game | result
  const [players, setPlayers] = useState([]);
  const [identities, setIdentities] = useState([]);
  const [pending, setPending] = useState(null); // vorgemerkter Account
  const [friendDialog, setFriendDialog] = useState(false);
  const [predictions, setPredictions] = useState({});
  const [scores, setScores] = useState({});
  const [modal, setModal] = useState(null);
  const [restartDialog, setRestartDialog] = useState(false);
  // Fehltipp-Schutz für schon gefüllte Zellen (siehe lib/useArmedCell.js).
  const { armed, requestEdit, disarm } = useArmedCell();

  // armed ist "<pIdx>:<cIdx>" — die Spalte will nur ihren eigenen Index.
  function armedFor(pIdx) {
    if (!armed) return null;
    const [p, c] = armed.split(":");
    return Number(p) === pIdx ? Number(c) : null;
  }

  const [newName, setNewName] = useState("");
  const [newPrediction, setNewPrediction] = useState("");
  const inputRef = useRef(null);

  // Vorschau aufs Rating für den Auswertungs-Screen. Steht hier oben, weil
  // darunter die frühen Returns je Phase beginnen — Hooks müssen in jedem
  // Render laufen. Geladen wird erst, wenn die Auswertung offen ist.
  const resultParticipants = useMemo(
    () => (phase === "result" ? toParticipants(buildGamePayload()) : []),
    // Absichtlich die EINGABEN von buildGamePayload() als Abhängigkeiten und
    // nicht die Funktion selbst — die wird bei jedem Render neu angelegt.
    [phase, players, identities, scores, predictions, profile],
  );
  const { rows: ratingRows } = useRatingPreview(resultParticipants, {
    active: phase === "result",
  });

  function addPlayer() {
    const name = newName.trim();
    const pred = parseInt(newPrediction);
    if (!name || isNaN(pred)) return;
    const idx = players.length;
    setPlayers((prev) => [...prev, name]);
    setIdentities((prev) => [...prev, pending?.id ?? null]);
    setPredictions((prev) => ({ ...prev, [idx]: pred }));
    setScores((prev) => ({ ...prev, [idx]: {} }));
    setNewName("");
    setNewPrediction("");
    setPending(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // Übernimmt einen Vorschlag ins Namensfeld. Nur ein echter Account wird
  // vorgemerkt — aus der "schon gespielt"-Liste kommen auch reine Gastnamen.
  function prefill(p) {
    setNewName(p.display_name);
    setPending(p.id ? p : null);
  }

  function updateScore(pIdx, cIdx, value, isKniffel = false) {
    setScores((prev) => {
      const playerScores = {
        ...prev[pIdx],
        [cIdx]: { value, timestamp: Date.now(), isKniffel },
      };
      return { ...prev, [pIdx]: refreshTotals(playerScores) };
    });
    setModal(null);
  }

  // Tap auf eine Zelle: durchklicken oder Sheet öffnen — wie im Normal-Modus,
  // inklusive Fehltipp-Schutz (siehe lib/useArmedCell.js).
  function handleTap(pIdx, cIdx) {
    const prev = scores[pIdx]?.[cIdx];
    const step = nextCellState(cIdx, prev);
    if (!step) return;
    if (step.kind === "sheet") {
      disarm();
      setModal({ pIdx, cIdx });
      return;
    }
    if (!requestEdit(`${pIdx}:${cIdx}`, !!prev)) {
      showToast({ text: "Nochmal tippen zum Ändern" });
      return;
    }
    // Außerhalb des Updaters, sonst feuert die Feier im StrictMode doppelt.
    // Oben mit Bedenkzeit, siehe lib/pendingCell.js.
    const cellKey = `${pIdx}:${cIdx}`;
    if (step.kind === "set" && step.entry.isKniffel) {
      armKniffel(cellKey, { kind: "upper", face: step.entry.face });
    } else if (step.kind === "set" && isStruck(cIdx, step.entry)) {
      armStrike(cellKey, {
        cIdx,
        category: CATEGORIES[cIdx],
        playerName: players[pIdx],
      });
    } else {
      cancelCellEvent(cellKey);
    }
    setScores((cur) => {
      const playerScores = { ...cur[pIdx] };
      if (step.kind === "set") playerScores[cIdx] = step.entry;
      else delete playerScores[cIdx];
      return { ...cur, [pIdx]: refreshTotals(playerScores) };
    });
    if (prev) {
      showToast({
        text: "Geändert",
        actionLabel: "Rückgängig",
        onAction: () => restoreCell(pIdx, cIdx, prev),
      });
    }
  }

  // Stellt den Stand vor dem letzten Tap wieder her (Rückgängig-Toast).
  function restoreCell(pIdx, cIdx, entry) {
    disarm();
    cancelCellEvent(`${pIdx}:${cIdx}`);
    setScores((cur) => {
      const playerScores = { ...cur[pIdx] };
      if (entry) playerScores[cIdx] = entry;
      else delete playerScores[cIdx];
      return { ...cur, [pIdx]: refreshTotals(playerScores) };
    });
  }

  function removeScore(pIdx, cIdx) {
    setScores((prev) => {
      const playerScores = { ...prev[pIdx] };
      delete playerScores[cIdx];
      return { ...prev, [pIdx]: refreshTotals(playerScores) };
    });
    setModal(null);
  }

  // Eine Quelle für das Speichern UND die Rating-Vorschau auf dem
  // Auswertungs-Screen — sonst driften Sieger und Punkte auseinander.
  function buildGamePayload() {
    const results = players.map((name, pIdx) => {
      const total = scores[pIdx]?.[14]?.value ?? 0;
      const diff = Math.abs(total - predictions[pIdx]);
      return { total, diff };
    });
    const minDiff = Math.min(...results.map((r) => r.diff));

    const kniffelCounts = players.map(
      (_, pIdx) =>
        Object.values(scores[pIdx] || {}).filter((e) => e.isKniffel).length,
    );

    return {
      mode: "lucky",
      players,
      identities: finalizeIdentities(players, identities, profile),
      finalScores: results.map((r) => r.total),
      // Gewinner ist hier, wer am nächsten am eigenen Tipp liegt
      isWinners: results.map((r) => r.diff === minDiff),
      kniffelCounts,
    };
  }

  // Einziger Speicherpfad: Auswertung ist nur Vorschau, gespeichert wird beim "Weiter"
  async function handleSaveAndExit() {
    await saveGame(buildGamePayload());
    onExit();
  }

  function handleRestart() {
    setPlayers([]);
    setIdentities([]);
    setPredictions({});
    setScores({});
    setPhase("setup");
    setRestartDialog(false);
  }

  // Setup Phase
  if (phase === "setup")
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#1e1e1e",
          display: "flex",
          flexDirection: "column",
          padding: 24,
          gap: 16,
          // Spielerliste + Vorschläge können den Screen überlaufen lassen —
          // ohne Scroll wäre "Spieler hinzufügen" am Handy nicht erreichbar.
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onExit}
            style={{
              background: "none",
              border: "none",
              color: "white",
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            ←
          </button>
          <div
            style={{
              color: "#673ab7",
              fontWeight: "bold",
              fontSize: 20,
              letterSpacing: 3,
            }}
          >
            🔮 LUCKY SCORE
          </div>
        </div>

        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
          Jeder tippt seinen Score — wer am nächsten dran ist gewinnt.
        </div>

        {players.map((name, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "white",
              background: "rgba(103,58,183,0.15)",
              borderRadius: 10,
              padding: "10px 14px",
            }}
          >
            <span>
              {name}{" "}
              {identities[i] && (
                <span
                  title="Verknüpfter Account — bekommt das Spiel auf die eigene Statistik"
                  style={{ color: "#673ab7" }}
                >
                  ☁
                </span>
              )}
            </span>
            <span style={{ color: "#673ab7", fontWeight: "bold" }}>
              Tipp: {predictions[i]}
            </span>
          </div>
        ))}

        <input
          ref={inputRef}
          className="dialog-input"
          placeholder="Name..."
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            setPending(null);
          }}
        />
        <input
          className="dialog-input"
          placeholder="Score-Tipp (z.B. 250)..."
          type="number"
          value={newPrediction}
          onChange={(e) => setNewPrediction(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPlayer()}
        />

        <RecentPlayersPicker
          query={newName}
          takenNames={players}
          takenIds={identities}
          onPick={prefill}
        />

        <PlayerLinkButtons
          profile={profile}
          identities={identities}
          onPrefill={prefill}
          onFriend={() => setFriendDialog(true)}
        />

        <button className="btn-outline" onClick={addPlayer}>
          {pending
            ? `„${pending.display_name}" hinzufügen ☁`
            : "Spieler hinzufügen"}
        </button>

        {friendDialog && (
          <FriendCodeDialog
            takenIds={identities.filter(Boolean)}
            onClose={() => setFriendDialog(false)}
            onResolve={prefill}
          />
        )}

        {players.length >= 2 && (
          <button
            className="btn-primary"
            style={{ marginTop: "auto" }}
            onClick={() => setPhase("game")}
          >
            SPIEL STARTEN →
          </button>
        )}
      </div>
    );

  // Result Phase
  if (phase === "result") {
    // pIdx mitführen: die Liste wird nach Abweichung sortiert, die
    // Rating-Zeilen liegen aber in der Reihenfolge der Spieler.
    const results = players
      .map((name, pIdx) => {
        const total = scores[pIdx]?.[14]?.value ?? 0;
        const pred = predictions[pIdx];
        const diff = Math.abs(total - pred);
        return { name, pIdx, total, pred, diff };
      })
      .sort((a, b) => a.diff - b.diff);

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#1e1e1e",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
        }}
      >
        <div style={{ fontSize: 48 }}>🔮</div>
        <div
          style={{
            color: "#673ab7",
            fontWeight: "bold",
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
              width: "100%",
              maxWidth: 340,
              background:
                i === 0 ? "rgba(103,58,183,0.3)" : "rgba(255,255,255,0.05)",
              border:
                i === 0
                  ? "2px solid #673ab7"
                  : "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: "14px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
              {i === 0 ? "🏆 " : i === 1 ? "🥈 " : "🥉 "}
              {r.name}
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
              Tipp: {r.pred} · Erreicht: {r.total} · Abweichung: {r.diff}
            </div>
            {ratingRows[r.pIdx] && (
              <RatingDelta {...ratingRows[r.pIdx]} index={i} />
            )}
          </div>
        ))}

        <div
          style={{
            color: "rgba(255,255,255,0.35)",
            fontSize: 12,
            marginTop: 4,
          }}
        >
          Fehler eingetragen?
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {/* Zurück zum Spiel ohne zu speichern */}
          <button className="btn-outline" onClick={() => setPhase("game")}>
            ✏️ Korrektur
          </button>
          {/* Speichern + beenden */}
          <button className="btn-primary" onClick={handleSaveAndExit}>
            Weiter →
          </button>
        </div>
      </div>
    );
  }

  // Game Phase
  return (
    <div className="app">
      <div className="app-bar">
        <button
          onClick={() => setRestartDialog(true)}
          style={{
            background: "none",
            border: "none",
            color: "white",
            fontSize: 18,
            cursor: "pointer",
            padding: "0 8px",
          }}
        >
          ←
        </button>
        🔮 LUCKY SCORE
        <button
          onClick={openGuide}
          aria-label="Anleitung"
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.75)",
            fontSize: 17,
            cursor: "pointer",
            width: 40,
          }}
        >
          ?
        </button>
      </div>

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
          {players.map((name, pIdx) => (
            <PlayerColumn
              key={pIdx}
              pIdx={pIdx}
              name={`${name} (${predictions[pIdx]})`}
              categories={CATEGORIES}
              playerScores={scores[pIdx] || {}}
              onTap={handleTap}
              armedCIdx={armedFor(pIdx)}
            />
          ))}
        </div>
      </div>

      <div className="footer">
        <button className="btn-danger" onClick={() => setRestartDialog(true)}>
          RESTART
        </button>
        <button className="btn-primary" onClick={() => setPhase("result")}>
          AUSWERTEN →
        </button>
      </div>

      {modal && (
        <ScoreInputModal
          pIdx={modal.pIdx}
          cIdx={modal.cIdx}
          categories={CATEGORIES}
          playerName={players[modal.pIdx]}
          onClose={() => setModal(null)}
          onSave={(val, isKniffel) =>
            updateScore(modal.pIdx, modal.cIdx, val, isKniffel)
          }
          onDelete={() => removeScore(modal.pIdx, modal.cIdx)}
        />
      )}

      {restartDialog && (
        <div
          className="dialog-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && setRestartDialog(false)
          }
        >
          <div className="dialog">
            <div className="dialog-title">Abbrechen?</div>
            <div className="dialog-actions">
              <button
                className="btn-outline"
                onClick={() => setRestartDialog(false)}
              >
                Weiter spielen
              </button>
              <button className="btn-danger" onClick={handleRestart}>
                Beenden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
