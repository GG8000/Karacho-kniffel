import { useState, useRef } from "react";
import PlayerColumn from "../components/PlayerColumn";
import ScoreInputModal from "../components/ScoreInputModal";
import FriendCodeDialog from "../components/FriendCodeDialog";
import PlayerLinkButtons from "../components/PlayerLinkButtons";
import { useAuth } from "../auth/AuthContext";
import { finalizeIdentities } from "../auth/identity";
import { calculateUpperBalance, calculateTotal } from "../logic/calculator";
import { saveGame } from "../storage";

const CATEGORIES = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "SUMME",
  "3er",
  "4er",
  "FH",
  "KL STR",
  "GR STR",
  "KNFFL",
  "CHNC",
  "TOTAL",
];

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

  const [newName, setNewName] = useState("");
  const [newPrediction, setNewPrediction] = useState("");
  const inputRef = useRef(null);

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

  function prefill(p) {
    setNewName(p.display_name);
    setPending(p);
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

  function removeScore(pIdx, cIdx) {
    setScores((prev) => {
      const playerScores = { ...prev[pIdx] };
      delete playerScores[cIdx];
      return { ...prev, [pIdx]: refreshTotals(playerScores) };
    });
    setModal(null);
  }

  // Einziger Speicherpfad: Auswertung ist nur Vorschau, gespeichert wird beim "Weiter"
  async function handleSaveAndExit() {
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

    await saveGame({
      mode: "lucky",
      players,
      identities: finalizeIdentities(players, identities, profile),
      finalScores: results.map((r) => r.total),
      // Gewinner ist hier, wer am nächsten am eigenen Tipp liegt
      isWinners: results.map((r) => r.diff === minDiff),
      kniffelCounts,
    });
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
    const results = players
      .map((name, pIdx) => {
        const total = scores[pIdx]?.[14]?.value ?? 0;
        const pred = predictions[pIdx];
        const diff = Math.abs(total - pred);
        return { name, total, pred, diff };
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
        <div style={{ width: 40 }} />
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
              onTap={(pIdx, cIdx) => setModal({ pIdx, cIdx })}
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
