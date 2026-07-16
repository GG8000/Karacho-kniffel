// Ordnet Spielernamen echten Accounts zu.
//
// Primär passiert das explizit: über den "Ich"-Button oder einen Freund-Code
// im Setup (-> identities[i] ist gesetzt). Als Fallback wird der eigene Account
// auch dann verknüpft, wenn der eingetragene Name exakt dem eigenen
// Spielernamen entspricht.
//
// Fremde werden NIE über den Namen verknüpft — zwei verschiedene Leute können
// denselben Namen tippen. Dafür gibt es ausschließlich den Freund-Code.

export function isMe(name, profile) {
  if (!profile?.display_name || !name) return false
  return name.trim().toLowerCase() === profile.display_name.trim().toLowerCase()
}

// Kombiniert die im Setup gesetzten Identitäten mit dem Namens-Fallback.
export function finalizeIdentities(players, identities = [], profile) {
  return players.map(
    (name, i) => identities[i] ?? (isMe(name, profile) ? profile.id : null),
  )
}
