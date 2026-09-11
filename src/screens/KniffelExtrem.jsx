import { useState, useMemo } from "react";
import ScoreInputModal from "../components/ScoreInputModal";
import FriendCodeDialog from "../components/FriendCodeDialog";
import PlayerLinkButtons from "../components/PlayerLinkButtons";
import RecentPlayersPicker from "../components/RecentPlayersPicker";
import { useAuth } from "../auth/AuthContext";
import { finalizeIdentities } from "../auth/identity";
import { calculateUpperBalance, calculateTotal } from "../logic/calculator";
import {
  CATEGORIES as CATS_NORMAL,
  PLAYABLE_INDICES,
  formatCell,
  isStruck,
  nextCellState,
} from "../logic/kniffel";
import { celebrateKniffel } from "../lib/celebrate";
import { armStrike, cancelStrike } from "../lib/strike";
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

// Welche Zellen eines Blocks angetippt werden dürfen.
//
// direction 'down' / 'up' erzwingen die Reihenfolge, 'free' lässt alles zu.
// Editierbar ist neben der nächsten freien Zelle immer auch die ZULETZT
// gefüllte: seit die Zellen durchgeklickt werden, wäre eine Zelle sonst nach
// dem ersten Tap ("0 Würfel") sofort gesperrt und nicht mehr korrigierbar.
function blockAccess(playerScores, direction) {
  if (direction === "free") {
    return { next: null, editable: new Set(PLAYABLE_INDICES) };
  }
  const order =
    direction === "up" ? [...PLAYABLE_INDICES].reverse() : PLAYABLE_INDICES;

  const pos = order.findIndex((ci) => !playerScores[ci]);
  const editable = new Set();
  if (pos === -1) {
    // Block voll — nur die zuletzt gefüllte Zelle bleibt korrigierbar.
    editable.add(order[order.length - 1]);
    return { next: null, editable };
  }
  editable.add(order[pos]);
  if (pos > 0) editable.add(order[pos - 1]);
  return { next: order[pos], editable };
}

function BlockColumn({
  label,
  categories,
  playerScores,
  access,
  onTap,
  pIdx,
  armedIdx = null,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minWidth: 80,
        borderLeft: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div
        style={{
          height: 36,
          background: "#673ab7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: "bold",
          color: "black",
        }}
      >
        {label}
      </div>
      {categories.map((cat, i) => {
        const realIdx = CATS_NORMAL.indexOf(cat);
        const entry = playerScores[realIdx];
        const isAuto = realIdx === 6 || realIdx === 14;
        const isNext = realIdx === access.next;
        const isClickable = !isAuto && access.editable.has(realIdx);
        // Einmal angetippt, ein zweiter Tap ändert erst (lib/useArmedCell.js).
        const isArmed = realIdx === armedIdx;

        return (
          <div
            key={i}
            onClick={isClickable ? () => onTap(pIdx, realIdx) : undefined}
            style={{
              position: "relative",
              outline: isArmed ? "2px solid #f5a623" : "none",
              outlineOffset: "-3px",
              flex: 1,
              minHeight: 40, // ← NEU: muss mit cat-cell Höhe übereinstimmen
              height: 40, // ← NEU
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: isNext ? "#f5a623" : "white",
              background: isArmed
                ? "rgba(245,166,35,0.18)"
                : isNext
                  ? "rgba(245,166,35,0.1)"
                  : isAuto
                    ? "rgba(255,255,255,0.05)"
                    : "transparent",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              cursor: isClickable ? "pointer" : "default",
              fontWeight: isAuto ? "bold" : "normal",
              opacity: entry ? 1 : isNext ? 1 : 0.3,
              WebkitTapHighlightColor: "transparent",
              boxSizing: "border-box", // ← NEU
            }}
          >
            {isAuto
              ? entry
                ? entry.value
                : ""
              : entry
                ? formatCell(realIdx, entry)
                : isNext
                  ? "→"
                  : ""}
          </div>
        );
      })}
    </div>
  );
}

export default function KniffelExtrem({ onExit }) {
  const { profile } = useAuth();
  const [phase, setPhase] = useState("setup");
  const [showResult, setShowResult] = useState(false); // ← NEU: trennt phase von Anzeige
  const [players, setPlayers] = useState([]);
  const [identities, setIdentities] = useState([]);
  const [pending, setPending] = useState(null); // vorgemerkter Account
  const [friendDialog, setFriendDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [scores, setScores] = useState({});
  const [modal, setModal] = useState(null);
  const [restartDialog, setRestartDialog] = useState(false);
  const [saving, setSaving] = useState(false); // sperrt die Speichern-Buttons
  // Fehltipp-Schutz für schon gefüllte Zellen (siehe lib/useArmedCell.js).
  const { armed, requestEdit, disarm } = useArmedCell();

  // armed ist "<pIdx>:<block>:<cIdx>" — die Spalte will nur ihren eigenen Index.
  function armedFor(pIdx, block) {
    if (!armed) return null;
    const [p, b, c] = armed.split(":");
    return Number(p) === pIdx && b === block ? Number(c) : null;
  }

  // Vorschau aufs Rating für den Auswertungs-Screen. Steht hier oben, weil
  // darunter die frühen Returns je Phase beginnen — Hooks müssen in jedem
  // Render laufen. Geladen wird erst, wenn die Auswertung offen ist.
  const resultParticipants = useMemo(
    () => (showResult ? toParticipants(buildGamePayload()) : []),
    // Absichtlich die EINGABEN von buildGamePayload() als Abhängigkeiten und
    // nicht die Funktion selbst — die wird bei jedem Render neu angelegt.
    [showResult, players, identities, scores, profile],
  );
  const { rows: ratingRows } = useRatingPreview(resultParticipants, {
    active: showResult,
  });

  // Leere Blöcke für eine Runde — beim Anlegen eines Spielers und bei der
  // Revanche dieselbe Form.
  const emptyBlocks = () => ({ topDown: {}, bottomUp: {}, normal: {} });

  function addPlayer() {
    const name = newName.trim();
    if (!name) return;
    const idx = players.length;
    setPlayers((prev) => [...prev, name]);
    setIdentities((prev) => [...prev, pending?.id ?? null]);
    setScores((prev) => ({ ...prev, [idx]: emptyBlocks() }));
    setNewName("");
    setPending(null);
  }

  // Übernimmt einen Vorschlag ins Namensfeld. Nur ein echter Account wird
  // vorgemerkt — aus der "schon gespielt"-Liste kommen auch reine Gastnamen.
  function prefill(p) {
    setNewName(p.display_name);
    setPending(p.id ? p : null);
  }

  function updateScore(pIdx, block, cIdx, value, isKniffel = false) {
    setScores((prev) => {
      const blockScores = {
        ...prev[pIdx][block],
        [cIdx]: { value, timestamp: Date.now(), isKniffel },
      };
      return {
        ...prev,
        [pIdx]: { ...prev[pIdx], [block]: refreshTotals(blockScores) },
      };
    });
    setModal(null);
  }

  // Tap auf eine Zelle: durchklicken oder Sheet öffnen. Wie im Normal-Modus,
  // nur mit dem Block als zusätzlicher Ebene.
  function handleTap(pIdx, block, cIdx) {
    const prev = scores[pIdx][block][cIdx];
    const step = nextCellState(cIdx, prev);
    if (!step) return;
    if (step.kind === "sheet") {
      disarm();
      setModal({ pIdx, cIdx, block });
      return;
    }
    if (!requestEdit(`${pIdx}:${block}:${cIdx}`, !!prev)) {
      showToast({ text: "Nochmal tippen zum Ändern" });
      return;
    }
    // Außerhalb des Updaters, sonst feuert die Feier im StrictMode doppelt.
    if (step.kind === "set" && step.entry.isKniffel) {
      celebrateKniffel({ kind: "upper", face: step.entry.face });
    }
    // Streichung ankündigen — oben mit Bedenkzeit (siehe lib/strike.js).
    if (step.kind === "set" && isStruck(cIdx, step.entry)) {
      armStrike(`${pIdx}:${block}:${cIdx}`, {
        cIdx,
        category: CATS_NORMAL[cIdx],
        playerName: players[pIdx],
      });
    } else {
      cancelStrike(`${pIdx}:${block}:${cIdx}`);
    }
    setScores((cur) => {
      const blockScores = { ...cur[pIdx][block] };
      if (step.kind === "set") blockScores[cIdx] = step.entry;
      else delete blockScores[cIdx];
      return {
        ...cur,
        [pIdx]: { ...cur[pIdx], [block]: refreshTotals(blockScores) },
      };
    });
    if (prev) {
      showToast({
        text: "Geändert",
        actionLabel: "Rückgängig",
        onAction: () => restoreCell(pIdx, block, cIdx, prev),
      });
    }
  }

  // Stellt den Stand vor dem letzten Tap wieder her (Rückgängig-Toast).
  function restoreCell(pIdx, block, cIdx, entry) {
    disarm();
    cancelStrike(`${pIdx}:${block}:${cIdx}`);
    setScores((cur) => {
      const blockScores = { ...cur[pIdx][block] };
      if (entry) blockScores[cIdx] = entry;
      else delete blockScores[cIdx];
      return {
        ...cur,
        [pIdx]: { ...cur[pIdx], [block]: refreshTotals(blockScores) },
      };
    });
  }

  function removeScore(pIdx, block, cIdx) {
    setScores((prev) => {
      const blockScores = { ...prev[pIdx][block] };
      delete blockScores[cIdx];
      return {
        ...prev,
        [pIdx]: { ...prev[pIdx], [block]: refreshTotals(blockScores) },
      };
    });
    setModal(null);
  }

  function getTotal(pIdx) {
    const s = scores[pIdx];
    if (!s) return 0;
    return (
      (s.topDown[14]?.value ?? 0) +
      (s.bottomUp[14]?.value ?? 0) +
      (s.normal[14]?.value ?? 0)
    );
  }

  // Nur Auswertung zeigen — noch NICHT speichern
  function openResult() {
    setShowResult(true);
  }

  function buildGamePayload() {
    const totals = players.map((_, pIdx) => getTotal(pIdx));
    const max = Math.max(...totals);
    const kniffelCounts = players.map((_, pIdx) => {
      const s = scores[pIdx];
      return ["topDown", "bottomUp", "normal"].reduce(
        (sum, block) =>
          sum + Object.values(s[block] || {}).filter((e) => e.isKniffel).length,
        0,
      );
    });
    return {
      mode: "extrem",
      players,
      identities: finalizeIdentities(players, identities, profile),
      finalScores: totals,
      isWinners: totals.map((t) => t === max),
      kniffelCounts,
    };
  }

  // Speichern + beenden
  async function handleSaveAndExit() {
    if (saving) return;
    setSaving(true);
    try {
      await saveGame(buildGamePayload());
      onExit();
    } finally {
      setSaving(false);
    }
  }

  // Revanche: speichert das beendete Spiel und startet dieselbe Runde neu —
  // Spieler und verknüpfte Accounts bleiben, nur die drei Blöcke werden leer.
  async function handleRepeat() {
    if (saving) return;
    setSaving(true);
    try {
      await saveGame(buildGamePayload());
      setScores(
        Object.fromEntries(players.map((_, i) => [i, emptyBlocks()])),
      );
      setShowResult(false);
    } finally {
      setSaving(false);
    }
  }

  function handleRestart() {
    setPlayers([]);
    setIdentities([]);
    setScores({});
    setPhase("setup");
    setShowResult(false);
    setRestartDialog(false);
  }

  // Setup
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
            🔥 KNIFFEL EXTREM
          </div>
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
          Drei Blöcke gleichzeitig — von oben, von unten, normal.
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
            <span>{name}</span>
            {identities[i] && (
              <span
                title="Verknüpfter Account — bekommt das Spiel auf die eigene Statistik"
                style={{ color: "#673ab7" }}
              >
                ☁
              </span>
            )}
          </div>
        ))}

        <input
          className="dialog-input"
          placeholder="Name..."
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            setPending(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && addPlayer()}
          autoFocus
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
          {pending ? `„${pending.display_name}" hinzufügen ☁` : "Spieler hinzufügen"}
        </button>

        {friendDialog && (
          <FriendCodeDialog
            takenIds={identities.filter(Boolean)}
            onClose={() => setFriendDialog(false)}
            onResolve={prefill}
          />
        )}

        {players.length >= 1 && (
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

  // Auswertungs-Screen — gleicher Flow wie normales Spiel
  if (showResult) {
    // pIdx mitführen: die Liste wird nach Punkten sortiert, die Rating-Zeilen
    // liegen aber in der Reihenfolge der Spieler.
    const results = players
      .map((name, pIdx) => ({ name, pIdx, total: getTotal(pIdx) }))
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
        <div style={{ fontSize: 48 }}>🔥</div>
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
              gap: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ color: "white", fontWeight: "bold" }}>
                {i === 0 ? "🏆 " : i === 1 ? "🥈 " : "🥉 "}
                {r.name}
              </div>
              <div
                style={{ color: "#673ab7", fontWeight: "bold", fontSize: 18 }}
              >
                {r.total}
              </div>
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

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {/* Zurück zum Spiel ohne zu speichern */}
          <button className="btn-outline" onClick={() => setShowResult(false)}>
            ✏️ Korrektur
          </button>
          {/* Nochmal — speichert und startet dieselbe Runde neu */}
          <button
            className="btn-outline"
            onClick={handleRepeat}
            disabled={saving}
          >
            🔁 Nochmal
          </button>
          {/* Speichern + Menü */}
          <button
            className="btn-primary"
            onClick={handleSaveAndExit}
            disabled={saving}
          >
            Weiter →
          </button>
        </div>
      </div>
    );
  }

  // Game Phase
  return (
    <div className="app">
      <div className="app-bar" style={{ fontSize: 14 }}>
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
        🔥 EXTREM
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
          {/* zwei Kopfzeilen (36+36) — passend zu Spielername + Block-Label (↓ ↑ ~) */}
          <div
            style={{
              height: 36,
              flexShrink: 0,
              border: "1px solid rgba(255,255,255,0.1)",
              borderBottom: "none",
            }}
          />
          <div
            style={{
              height: 36,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "grey",
              fontSize: 13,
            }}
          >
            KAT
          </div>
          {CATS_NORMAL.map((cat, i) => (
            <div key={i} className="cat-cell" style={{ flex: "none" }}>
              {cat}
            </div>
          ))}
        </div>

        <div className="players-area">
          {players.map((name, pIdx) => {
            const s = scores[pIdx];
            const accessTD = blockAccess(s.topDown, "down");
            const accessBU = blockAccess(s.bottomUp, "up");
            const accessFree = blockAccess(s.normal, "free");

            return (
              <div
                key={pIdx}
                style={{ display: "flex", flexDirection: "column" }}
              >
                <div
                  style={{
                    display: "flex",
                    height: 36,
                    background: "#673ab7",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                    color: "black",
                    fontSize: 12,
                    borderLeft: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {name} · {getTotal(pIdx)}
                </div>
                <div style={{ display: "flex" }}>
                  <BlockColumn
                    label="↓"
                    pIdx={pIdx}
                    categories={CATS_NORMAL}
                    playerScores={s.topDown}
                    access={accessTD}
                    onTap={(p, c) => handleTap(p, "topDown", c)}
                    armedIdx={armedFor(pIdx, "topDown")}
                  />
                  <BlockColumn
                    label="↑"
                    pIdx={pIdx}
                    categories={CATS_NORMAL}
                    playerScores={s.bottomUp}
                    access={accessBU}
                    onTap={(p, c) => handleTap(p, "bottomUp", c)}
                    armedIdx={armedFor(pIdx, "bottomUp")}
                  />
                  <BlockColumn
                    label="~"
                    pIdx={pIdx}
                    categories={CATS_NORMAL}
                    playerScores={s.normal}
                    access={accessFree}
                    onTap={(p, c) => handleTap(p, "normal", c)}
                    armedIdx={armedFor(pIdx, "normal")}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="footer">
        <button className="btn-danger" onClick={() => setRestartDialog(true)}>
          RESTART
        </button>
        <button className="btn-primary" onClick={openResult}>
          AUSWERTEN →
        </button>
      </div>

      {modal && (
        <ScoreInputModal
          pIdx={modal.pIdx}
          cIdx={modal.cIdx}
          categories={CATS_NORMAL}
          playerName={players[modal.pIdx]}
          onClose={() => setModal(null)}
          onSave={(val, isKniffel) =>
            updateScore(modal.pIdx, modal.block, modal.cIdx, val, isKniffel)
          }
          onDelete={() => removeScore(modal.pIdx, modal.block, modal.cIdx)}
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
