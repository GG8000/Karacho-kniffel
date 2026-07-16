// "Ich"- und "Freund-Code"-Buttons für die Spieler-Auswahl.
// Füllt den Namen vor und merkt den Account vor; hinzugefügt wird erst mit dem
// normalen "Spieler hinzufügen" des jeweiligen Modus.
export default function PlayerLinkButtons({
  profile,
  identities = [],
  onPrefill,
  onFriend,
}) {
  if (!profile) return null // Gast-Modus: nichts zu verknüpfen

  const meAdded = identities.includes(profile.id)
  const style = { flex: 1, padding: '10px 12px', fontSize: 13, minHeight: 40 }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
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
      <button className="btn-outline" style={style} onClick={onFriend}>
        ＋ Freund-Code
      </button>
    </div>
  )
}
