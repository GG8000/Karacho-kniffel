import { useState, useRef, useEffect } from "react";
import PlayerColumn from "./components/PlayerColumn";
import ScoreInputModal from "./components/ScoreInputModal";
import ModeSelect from "./screens/ModeSelect";
import LuckyScoreGame from "./screens/LuckyScoreGame";
import KniffelExtrem from "./screens/KniffelExtrem";
import Statistics from "./screens/Statistics";
import Login from "./screens/Login";
import ProfileSetup, { NAME_CONFIRMED_KEY } from "./screens/ProfileSetup";
import FriendCodeDialog from "./components/FriendCodeDialog";
import PlayerLinkButtons from "./components/PlayerLinkButtons";
import { useAuth } from "./auth/AuthContext";
import { finalizeIdentities } from "./auth/identity";
import { calculateUpperBalance, calculateTotal } from "./logic/calculator";
import { saveGame, syncPending, importLegacyHistory } from "./storage";
import "./App.css";

const PLAYABLE_INDICES = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13];

function isGameComplete(players, scores) {
  return (
    players.length > 0 &&
    players.every((_, pIdx) =>
      PLAYABLE_INDICES.every((cIdx) => scores[pIdx]?.[cIdx] !== undefined),
    )
  );
}

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

function LoadingScreen({ onDone }) {
  const fillRef = useRef(null)
  const outerRef = useRef(null)
  const midRef = useRef(null)
  const innerRef = useRef(null)
  const diceRef = useRef(null)
  const groupRef = useRef(null)
  const screenRef = useRef(null)
  const trackRef = useRef(null)
  const titleRef = useRef(null)

  useEffect(() => {
    const duration = 5000
    const launchAt = 0.78
    let start = null
    let launched = false
    let raf

    function spawnEmber(hot) {
      const el = document.createElement('div')
      const ex = (Math.random() - 0.5) * 80
      const ey = 20 + Math.random() * 70
      Object.assign(el.style, {
        position: 'absolute', width: '3px', height: '3px',
        borderRadius: '50%', background: hot ? '#fff' : '#ff6600',
        left: '50%', top: '55%', pointerEvents: 'none',
        animation: 'emberFly 1.2s ease-out forwards',
        '--ex': ex + 'px', '--ey': ey + 'px',
      })
      screenRef.current?.appendChild(el)
      setTimeout(() => el.remove(), 1200)
    }

    function update(ts) {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)

      if (fillRef.current) fillRef.current.style.width = (p * 100) + '%'

      if (p < launchAt) {
        const fp = p / launchAt
        if (outerRef.current) outerRef.current.style.height = (fp * 50) + 'px'
        if (midRef.current) midRef.current.style.height = (fp * 36) + 'px'
        if (innerRef.current) innerRef.current.style.height = (fp * 22) + 'px'
        if (groupRef.current) {
          const s = fp * 3
          groupRef.current.style.transform = `rotate(${(Math.random() - 0.5) * s}deg) translateX(${(Math.random() - 0.5) * s}px)`
        }
        if (diceRef.current) {
          const g = Math.round(fp * 20)
          diceRef.current.style.filter = `drop-shadow(0 0 ${g}px rgba(255,${Math.round(80 + fp * 80)},0,${0.4 + fp * 0.6}))`
        }
        if (fp > 0.3 && Math.random() < 0.12) spawnEmber(false)
      }

      if (p >= launchAt && !launched) {
        launched = true
        if (outerRef.current) outerRef.current.style.height = '80px'
        if (midRef.current) midRef.current.style.height = '60px'
        if (innerRef.current) innerRef.current.style.height = '40px'
        if (groupRef.current) {
          groupRef.current.style.transition = `transform ${(1 - launchAt) * duration}ms cubic-bezier(0.2,0,0.8,1)`
          groupRef.current.style.transform = 'translateY(-900px)'
        }
        if (trackRef.current) {
          trackRef.current.style.transition = 'opacity 0.3s'
          trackRef.current.style.opacity = '0'
        }
        for (let i = 0; i < 20; i++) setTimeout(() => spawnEmber(true), i * 60)
        setTimeout(() => {
          if (titleRef.current) {
            titleRef.current.style.animation = 'karáchoIn 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards'
            titleRef.current.style.opacity = '1'
          }
        }, (1 - launchAt) * duration * 0.4)
      }

      if (p < 1) {
        raf = requestAnimationFrame(update)
      } else {
        setTimeout(onDone, 800)
      }
    }

    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={screenRef} style={{
      position: 'fixed', inset: 0, background: '#1e1e1e',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, overflow: 'hidden',
    }}>
      <style>{`
        @keyframes emberFly {
          0% { opacity:1; transform:translate(0,0) scale(1); }
          100% { opacity:0; transform:translate(var(--ex),var(--ey)) scale(0.2); }
        }
        @keyframes karáchoIn {
          0% { opacity:0; transform:scale(0.4) translateY(20px); }
          60% { opacity:1; transform:scale(1.08) translateY(-4px); }
          100% { opacity:1; transform:scale(1) translateY(0); }
        }
      `}</style>

      {/* Rakete: Würfel oben, Flamme unten */}
      <div ref={groupRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div ref={diceRef} style={{ fontSize: 52, zIndex: 2 }}>🎲</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: -4 }}>
          <div ref={outerRef} style={{
            width: 28, height: 0,
            background: 'linear-gradient(to bottom, #ff6600, #ff9900, #ffcc00, transparent)',
            borderRadius: '20% 20% 50% 50%',
          }} />
          <div ref={midRef} style={{
            width: 16, height: 0, marginTop: -4,
            background: 'linear-gradient(to bottom, #ff3300, #ff6600, #ffee00, transparent)',
            borderRadius: '20% 20% 50% 50%',
          }} />
          <div ref={innerRef} style={{
            width: 8, height: 0, marginTop: -6,
            background: 'linear-gradient(to bottom, #fff, #ffee88, transparent)',
            borderRadius: '20% 20% 50% 50%',
          }} />
        </div>
      </div>

      {/* Progress */}
      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div ref={trackRef} style={{ width: 180, height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
          <div ref={fillRef} style={{ height: '100%', width: '0%', background: '#673ab7', borderRadius: 3 }} />
        </div>
      </div>

      {/* Karacho Kniffel Titel */}
      <div ref={titleRef} style={{
        position: 'absolute', opacity: 0,
        display: 'flex', gap: 12, alignItems: 'center',
      }}>
        <span style={{ fontSize: 28, fontWeight: 'bold', letterSpacing: 3, color: '#ff6600' }}>KARACHO</span>
        <span style={{ fontSize: 28, fontWeight: 'bold', letterSpacing: 3, color: '#673ab7' }}>KNIFFEL</span>
      </div>
    </div>
  )
}

export default function App() {
  const {
    loading: authLoading,
    isLoggedIn,
    guest,
    profile,
  } = useAuth();
  const [loading, setLoading] = useState(true);
  const [nameConfirmed, setNameConfirmed] = useState(
    () => localStorage.getItem(NAME_CONFIRMED_KEY) === "1",
  );
  const [screen, setScreen] = useState("modeSelect");
  const [players, setPlayers] = useState([]);
  const [identities, setIdentities] = useState([]);
  const [pending, setPending] = useState(null); // vorgemerkter Account
  const [friendDialog, setFriendDialog] = useState(false);
  const [scores, setScores] = useState({});
  const [modal, setModal] = useState(null);
  const [addDialog, setAddDialog] = useState(false);
  const [removeDialog, setRemoveDialog] = useState(false); // NEU
  const [restartDialog, setRestartDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [gameComplete, setGameComplete] = useState(false); // NEU: ersetzt resultScreen
  const [showResult, setShowResult] = useState(false); // NEU: trennt "fertig" von "Auswertung sichtbar"
  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  // Alte lokale Historie einmalig übernehmen — erst nachdem der Spielername
  // feststeht, sonst wird sie dem falschen Namen zugeordnet.
  useEffect(() => {
    if (!isLoggedIn || !profile || !nameConfirmed) return;
    importLegacyHistory(profile).catch(() => {});
  }, [isLoggedIn, profile, nameConfirmed]);

  // Offene Spiele nachschieben, sobald wieder Netz/Fokus da ist
  useEffect(() => {
    if (!isLoggedIn) return;
    const sync = () => syncPending().catch(() => {});
    sync();
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [isLoggedIn]);

  function updateScore(pIdx, cIdx, value, isKniffel = false) {
    setScores((prev) => {
      const playerScores = {
        ...prev[pIdx],
        [cIdx]: { value, timestamp: Date.now(), isKniffel },
      };
      const updated = { ...prev, [pIdx]: refreshTotals(playerScores) };
      if (isGameComplete(players, updated)) {
        setTimeout(() => {
          setGameComplete(true);
          setShowResult(true);
        }, 300);
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
    setIdentities((prev) => [...prev, pending?.id ?? null]);
    setScores((prev) => ({ ...prev, [idx]: {} }));
    setNewName("");
    setPending(null);
    setAddDialog(false);
  }

  function prefill(p) {
    setNewName(p.display_name);
    setPending(p);
  }

  // NEU: Spieler entfernen — reindiziert alle Scores danach
  function handleRemovePlayer(removeIdx) {
    setPlayers((prev) => prev.filter((_, i) => i !== removeIdx));
    setIdentities((prev) => prev.filter((_, i) => i !== removeIdx));
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
    setPending(null);
    setAddDialog(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function buildGamePayload() {
    const kniffelCounts = players.map(
      (_, pIdx) =>
        Object.values(scores[pIdx] || {}).filter((e) => e.isKniffel).length,
    );
    const totals = players.map((_, pIdx) => scores[pIdx]?.[14]?.value ?? 0);
    const maxTotal = Math.max(...totals);
    return {
      mode: "normal",
      players,
      identities: finalizeIdentities(players, identities, profile),
      finalScores: totals,
      isWinners: totals.map((t) => t === maxTotal),
      kniffelCounts,
    };
  }

  // Speichern + zurück zum Menü
  async function handleSaveAndExit() {
    await saveGame(buildGamePayload());
    goToModeSelect();
  }

  async function handleRestart() {
    if (players.length > 0) {
      await saveGame(buildGamePayload());
    }
    setPlayers([]);
    setIdentities([]);
    setScores({});
    setRestartDialog(false);
    setGameComplete(false);
    setShowResult(false);
  }

  function goToModeSelect() {
    setScreen("modeSelect");
    setPlayers([]);
    setIdentities([]);
    setScores({});
    setGameComplete(false);
    setShowResult(false);
  }

  if (loading) return <LoadingScreen onDone={() => setLoading(false)} />;
  if (authLoading)
    return <div style={{ position: "fixed", inset: 0, background: "#1e1e1e" }} />;
  if (!isLoggedIn && !guest) return <Login />;
  if (isLoggedIn && profile && !nameConfirmed)
    return <ProfileSetup onDone={() => setNameConfirmed(true)} />;
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
        <div style={{ fontSize: 48 }}>🏆</div>
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
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
              {i === 0 ? "🏆 " : i === 1 ? "🥈 " : "🥉 "}
              {r.name}
            </div>
            <div style={{ color: "#673ab7", fontWeight: "bold", fontSize: 18 }}>
              {r.total}
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
          {/* Korrektur — zurück ohne zu speichern */}
          <button className="btn-outline" onClick={() => setShowResult(false)}>
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
        KNIFFEL BLOCK
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
        <button className="btn-danger" onClick={() => setRestartDialog(true)}>
          RESTART
        </button>
        {/* Wenn Spiel fertig aber Auswertung weggeklickt — Auswerten Button zeigen */}
        {gameComplete ? (
          <button className="btn-primary" onClick={() => setShowResult(true)}>
            AUSWERTEN →
          </button>
        ) : (
          <button className="btn-primary" onClick={openAddDialog}>
            SPIELER +
          </button>
        )}
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

      {addDialog && (
        <div
          className="dialog-overlay"
          onClick={(e) => e.target === e.currentTarget && setAddDialog(false)}
        >
          <div className="dialog">
            <div className="dialog-title">Neuer Spieler</div>
            <input
              ref={inputRef}
              className="dialog-input"
              placeholder="Name eingeben..."
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setPending(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
              autoFocus
            />
            <PlayerLinkButtons
              profile={profile}
              identities={identities}
              onPrefill={prefill}
              onFriend={() => setFriendDialog(true)}
            />
            <div className="dialog-actions">
              <button
                className="btn-outline"
                onClick={() => setAddDialog(false)}
              >
                Abbrechen
              </button>
              <button className="btn-primary" onClick={handleAddPlayer}>
                {pending ? `„${pending.display_name}" ☁` : "Hinzufügen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {friendDialog && (
        <FriendCodeDialog
          takenIds={identities.filter(Boolean)}
          onClose={() => setFriendDialog(false)}
          onResolve={prefill}
        />
      )}

      {/* NEU: Spieler entfernen Dialog */}
      {removeDialog !== false && (
        <div
          className="dialog-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && setRemoveDialog(false)
          }
        >
          <div className="dialog">
            <div className="dialog-title">
              "{players[removeDialog]}" entfernen?
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
              Alle Punkte dieses Spielers werden gelöscht.
            </div>
            <div className="dialog-actions">
              <button
                className="btn-outline"
                onClick={() => setRemoveDialog(false)}
              >
                Abbrechen
              </button>
              <button
                className="btn-danger"
                onClick={() => handleRemovePlayer(removeDialog)}
              >
                Entfernen
              </button>
            </div>
          </div>
        </div>
      )}

      {restartDialog && (
        <div
          className="dialog-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && setRestartDialog(false)
          }
        >
          <div className="dialog">
            <div className="dialog-title">Spiel neu starten?</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
              Alle Punkte werden gespeichert und gelöscht.
            </div>
            <div className="dialog-actions">
              <button
                className="btn-outline"
                onClick={() => setRestartDialog(false)}
              >
                Abbrechen
              </button>
              <button className="btn-danger" onClick={handleRestart}>
                Neu starten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
