import { useState, useRef, useEffect } from "react";
import PlayerColumn from "./components/PlayerColumn";
import ScoreInputModal from "./components/ScoreInputModal";
import ModeSelect from "./screens/ModeSelect";
import LuckyScoreGame from "./screens/LuckyScoreGame";
import KniffelExtrem from "./screens/KniffelExtrem";
import Statistics from "./screens/Statistics";
import { calculateUpperBalance, calculateTotal } from "./logic/calculator";
import { saveGame } from "./storage";
import "./App.css";

const PLAYABLE_INDICES = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13];

function isGameComplete(players, scores) {
  return (
    players.length > 0 &&
    players.every((_, pIdx) =>
      PLAYABLE_INDICES.every((cIdx) => scores[pIdx]?.[cIdx] !== undefined)
    )
  );
}

const CATEGORIES = [
  "1", "2", "3", "4", "5", "6", "SUMME",
  "3er", "4er", "FH", "KL STR", "GR STR", "KNFFL", "CHNC", "TOTAL",
];

function refreshTotals(playerScores) {
  const now = Date.now();
  return {
    ...playerScores,
    6: { value: calculateUpperBalance(playerScores), timestamp: now },
    14: { value: calculateTotal(playerScores), timestamp: now },
  };
}

function LoadingScreen({ onDone }) {
  const videoRef = useRef(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => onDone());
    const fallback = setTimeout(onDone, 5000);
    return () => clearTimeout(fallback);
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 9999 }}>
      <video
        ref={videoRef} src="/splash.mp4" muted playsInline onEnded={onDone}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("modeSelect");
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState({});
  const [modal, setModal] = useState(null);
  const [addDialog, setAddDialog] = useState(false);
  const [removeDialog, setRemoveDialog] = useState(false); // NEU
  const [restartDialog, setRestartDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [gameComplete, setGameComplete] = useState(false); // NEU: ersetzt resultScreen
  const [showResult, setShowResult] = useState(false);     // NEU: trennt "fertig" von "Auswertung sichtbar"
  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  function updateScore(pIdx, cIdx, value, isKniffel = false) {
    setScores((prev) => {
      const playerScores = {
        ...prev[pIdx],
        [cIdx]: { value, timestamp: Date.now(), isKniffel },
      };
      const updated = { ...prev, [pIdx]: refreshTotals(playerScores) };
      if (isGameComplete(players, updated)) {
        setTimeout(() => { setGameComplete(true); setShowResult(true); }, 300);
      }
      return updated;
    });
    setModal(null);
  }

  function removeScore(pIdx, cIdx) {
    setScores((prev) => {
      const playerScores = { ...prev[pIdx] };
      delete playerScores[cIdx];
      return { ...prev, [pIdx]: refreshTotals(playerScores) };
    });
    // Wenn Spieler eine Korrektur macht, Spiel wieder als unfertig markieren
    setGameComplete(false);
    setModal(null);
  }

  function handleAddPlayer() {
    const name = newName.trim();
    if (!name) return;
    const idx = players.length;
    setPlayers((prev) => [...prev, name]);
    setScores((prev) => ({ ...prev, [idx]: {} }));
    setNewName("");
    setAddDialog(false);
  }

  // NEU: Spieler entfernen — reindiziert alle Scores danach
  function handleRemovePlayer(removeIdx) {
    setPlayers((prev) => prev.filter((_, i) => i !== removeIdx));
    setScores((prev) => {
      const newScores = {};
      let newIdx = 0;
      Object.entries(prev).forEach(([key, val]) => {
        if (parseInt(key) !== removeIdx) {
          newScores[newIdx++] = val;
        }
      });
      return newScores;
    });
    setGameComplete(false);
    setRemoveDialog(false);
  }

  function openAddDialog() {
    setNewName("");
    setAddDialog(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // Speichern + zurück zum Menü
  function handleSaveAndExit() {
    const kniffelCounts = players.map((_, pIdx) =>
      Object.values(scores[pIdx] || {}).filter((e) => e.isKniffel).length
    );
    const totals = players.map((_, pIdx) => scores[pIdx]?.[14]?.value ?? 0);
    const maxTotal = Math.max(...totals);
    const winners = players.filter((_, pIdx) => totals[pIdx] === maxTotal);
    saveGame({ mode: "normal", players, scores, winners, kniffelCounts });
    goToModeSelect();
  }

  function handleRestart() {
    const kniffelCounts = players.map((_, pIdx) =>
      Object.values(scores[pIdx] || {}).filter((e) => e.isKniffel).length
    );
    const totals = players.map((_, pIdx) => scores[pIdx]?.[14]?.value ?? 0);
    const maxTotal = Math.max(...totals);
    const winners = players.filter((_, pIdx) => totals[pIdx] === maxTotal);
    if (players.length > 0) {
      saveGame({ mode: "normal", players, scores, winners, kniffelCounts });
    }
    setPlayers([]);
    setScores({});
    setRestartDialog(false);
    setGameComplete(false);
    setShowResult(false);
  }

  function goToModeSelect() {
    setScreen("modeSelect");
    setPlayers([]);
    setScores({});
    setGameComplete(false);
    setShowResult(false);
  }

  if (loading) return <LoadingScreen onDone={() => setLoading(false)} />;
  if (screen === "modeSelect") return <ModeSelect onSelect={setScreen} />;
  if (screen === "lucky") return <LuckyScoreGame onExit={goToModeSelect} />;
  if (screen === "extrem") return <KniffelExtrem onExit={goToModeSelect} />;
  if (screen === "stats") return <Statistics onBack={goToModeSelect} />;

  // Auswertungs-Screen
  if (showResult) {
    const results = players
      .map((name, pIdx) => ({ name, total: scores[pIdx]?.[14]?.value ?? 0 }))
      .sort((a, b) => b.total - a.total);

    return (
      <div style={{
        position: "fixed", inset: 0, background: "#1e1e1e",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 16, padding: 24,
      }}>
        <div style={{ fontSize: 48 }}>🏆</div>
        <div style={{ color: "#673ab7", fontWeight: "bold", fontSize: 22, letterSpacing: 3 }}>
          AUSWERTUNG
        </div>

        {results.map((r, i) => (
          <div key={i} style={{
            width: "100%", maxWidth: 340,
            background: i === 0 ? "rgba(103,58,183,0.3)" : "rgba(255,255,255,0.05)",
            border: i === 0 ? "2px solid #673ab7" : "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12, padding: "14px 18px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
              {i === 0 ? "🏆 " : i === 1 ? "🥈 " : "🥉 "}{r.name}
            </div>
            <div style={{ color: "#673ab7", fontWeight: "bold", fontSize: 18 }}>
              {r.total}
            </div>
          </div>
        ))}

        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 4 }}>
          Fehler eingetragen?
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {/* Korrektur — zurück ohne zu speichern */}
          <button
            className="btn-outline"
            onClick={() => setShowResult(false)}
          >
            ✏️ Korrektur
          </button>
          {/* Weiter — speichert und geht ins Menü */}
          <button className="btn-primary" onClick={handleSaveAndExit}>
            Weiter →
          </button>
        </div>
      </div>
    );
  }

  // Normal Game
  return (
    <div className="app">
      <div className="app-bar">
        <button
          onClick={goToModeSelect}
          style={{ background: "none", border: "none", color: "white", fontSize: 18, cursor: "pointer", padding: "0 8px" }}
        >
          ←
        </button>
        KNIFFEL BLOCK
        <div style={{ width: 40 }} />
      </div>

      <div className="game-area">
        <div className="categories-column">
          <div className="cat-header">KAT</div>
          {CATEGORIES.map((cat, i) => (
            <div key={i} className="cat-cell">{cat}</div>
          ))}
        </div>

        <div className="players-area">
          {players.map((name, pIdx) => (
            <PlayerColumn
              key={pIdx}
              pIdx={pIdx}
              name={name}
              categories={CATEGORIES}
              playerScores={scores[pIdx] || {}}
              onTap={(pIdx, cIdx) => setModal({ pIdx, cIdx })}
              onRemove={() => setRemoveDialog(pIdx)} // NEU
            />
          ))}
        </div>
      </div>

      <div className="footer">
        <button className="btn-danger" onClick={() => setRestartDialog(true)}>RESTART</button>
        {/* Wenn Spiel fertig aber Auswertung weggeklickt — Auswerten Button zeigen */}
        {gameComplete ? (
          <button className="btn-primary" onClick={() => setShowResult(true)}>
            AUSWERTEN →
          </button>
        ) : (
          <button className="btn-primary" onClick={openAddDialog}>SPIELER +</button>
        )}
      </div>

      {modal && (
        <ScoreInputModal
          pIdx={modal.pIdx} cIdx={modal.cIdx} categories={CATEGORIES}
          onClose={() => setModal(null)}
          onSave={(val, isKniffel) => updateScore(modal.pIdx, modal.cIdx, val, isKniffel)}
          onDelete={() => removeScore(modal.pIdx, modal.cIdx)}
        />
      )}

      {addDialog && (
        <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && setAddDialog(false)}>
          <div className="dialog">
            <div className="dialog-title">Neuer Spieler</div>
            <input
              ref={inputRef} className="dialog-input"
              placeholder="Name eingeben..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
              autoFocus
            />
            <div className="dialog-actions">
              <button className="btn-outline" onClick={() => setAddDialog(false)}>Abbrechen</button>
              <button className="btn-primary" onClick={handleAddPlayer}>Hinzufügen</button>
            </div>
          </div>
        </div>
      )}

      {/* NEU: Spieler entfernen Dialog */}
      {removeDialog !== false && (
        <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && setRemoveDialog(false)}>
          <div className="dialog">
            <div className="dialog-title">"{players[removeDialog]}" entfernen?</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
              Alle Punkte dieses Spielers werden gelöscht.
            </div>
            <div className="dialog-actions">
              <button className="btn-outline" onClick={() => setRemoveDialog(false)}>Abbrechen</button>
              <button className="btn-danger" onClick={() => handleRemovePlayer(removeDialog)}>Entfernen</button>
            </div>
          </div>
        </div>
      )}

      {restartDialog && (
        <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && setRestartDialog(false)}>
          <div className="dialog">
            <div className="dialog-title">Spiel neu starten?</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
              Alle Punkte werden gespeichert und gelöscht.
            </div>
            <div className="dialog-actions">
              <button className="btn-outline" onClick={() => setRestartDialog(false)}>Abbrechen</button>
              <button className="btn-danger" onClick={handleRestart}>Neu starten</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}