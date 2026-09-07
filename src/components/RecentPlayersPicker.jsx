import { useEffect, useMemo, useState } from 'react'
import { getKnownPlayers } from '../storage'

// Vorschlagsliste beim Anlegen eines Spielers: alle Namen aus der Historie,
// zuletzt gespielte zuerst. Ergänzt PlayerLinkButtons — dort geht es um echte
// Accounts (Ich / Freunde / Code), hier um "mit wem habe ich schon gespielt",
// Gäste eingeschlossen.
//
// Klappt beim Tippen von selbst auf und filtert mit; wer schon am Block steht,
// fällt raus.
export default function RecentPlayersPicker({
  query = '',
  takenNames = [],
  takenIds = [],
  onPick,
}) {
  const [known, setKnown] = useState(null) // null = lädt noch
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    getKnownPlayers()
      .then((list) => alive && setKnown(list))
      .catch(() => alive && setKnown([]))
    return () => {
      alive = false
    }
  }, [])

  const q = query.trim().toLowerCase()

  // Sobald getippt wird, ist die Liste relevant — dann von selbst aufklappen.
  useEffect(() => {
    if (q) setOpen(true)
  }, [q])

  const taken = useMemo(
    () => new Set(takenNames.map((n) => (n ?? '').trim().toLowerCase())),
    [takenNames],
  )
  const takenProfiles = useMemo(
    () => new Set(takenIds.filter(Boolean)),
    [takenIds],
  )

  const matches = (known ?? []).filter((p) => {
    if (p.profileId && takenProfiles.has(p.profileId)) return false
    if (taken.has(p.name.toLowerCase())) return false
    return !q || p.name.toLowerCase().includes(q)
  })

  // Erstes Spiel überhaupt, oder alle Vorschläge stehen schon am Block.
  if (!matches.length) return null

  return (
    <div className="recent-players">
      <button
        type="button"
        className="recent-players-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        <span>🕘 Schon gespielt ({matches.length})</span>
        <span>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="recent-players-list">
          {matches.map((p) => (
            <button
              type="button"
              key={p.key}
              className="recent-players-item"
              onClick={() => onPick({ id: p.profileId, display_name: p.name })}
            >
              <span className="recent-players-name">{p.name}</span>
              {p.profileId && (
                <span
                  title="Verknüpfter Account — bekommt das Spiel auf die eigene Statistik"
                  style={{ color: '#b388ff' }}
                >
                  ☁
                </span>
              )}
              <span className="recent-players-count">{p.games}×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
