import { useState } from 'react'
import FriendsPicker from './FriendsPicker'

// "Ich"-, "Freunde"- und "Freund-Code"-Buttons für die Spieler-Auswahl.
// Füllt den Namen vor und merkt den Account vor; hinzugefügt wird erst mit dem
// normalen "Spieler hinzufügen" des jeweiligen Modus.
export default function PlayerLinkButtons({
  profile,
  identities = [],
  onPrefill,
  onFriend,
}) {
  const [picking, setPicking] = useState(false)

  if (!profile) return null // Gast-Modus: nichts zu verknüpfen

  const meAdded = identities.includes(profile.id)
  const takenIds = identities.filter(Boolean)
  const style = { flex: 1, padding: '10px 12px', fontSize: 13, minHeight: 40 }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!meAdded && (
          <button
            className="btn-outline"
            style={style}
            onClick={() =>
              onPrefill({ id: profile.id, display_name: profile.display_name })
            }
          >
            ＋ Ich
          </button>
        )}
        <button
          className="btn-outline"
          style={style}
          onClick={() => setPicking(true)}
        >
          👥 Freunde
        </button>
        <button className="btn-outline" style={style} onClick={onFriend}>
          ＋ Code
        </button>
      </div>

      {picking && (
        <FriendsPicker
          takenIds={takenIds}
          onPick={(p) =>
            onPrefill({ id: p.id, display_name: p.display_name })
          }
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}
