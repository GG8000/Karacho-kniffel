import { supabase, isSupabaseConfigured } from '../lib/supabase'

async function currentUserId() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data?.user?.id ?? null
}

// Sucht ein Profil per Freund-Code (profiles.handle).
// Erlaubt durch die RLS-Policy "profiles readable" für angemeldete Nutzer.
export async function findProfileByHandle(handle) {
  if (!isSupabaseConfigured) return null
  const value = handle.trim().toLowerCase()
  if (!value) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, handle')
    .ilike('handle', value)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

// Meine gespeicherten Freunde (Profile). Embed über den FK friends.friend_id.
export async function listFriends() {
  const uid = await currentUserId()
  if (!uid) return []

  const { data, error } = await supabase
    .from('friends')
    .select('friend:profiles!friend_id(id, display_name, handle)')
    .eq('owner_id', uid)

  if (error) throw error
  return (data ?? [])
    .map((r) => r.friend)
    .filter(Boolean)
    .sort((a, b) => (a.display_name ?? '').localeCompare(b.display_name ?? ''))
}

// Legt die Freundschaft in BEIDE Richtungen an (A↔B). Läuft über eine
// security-definer-Funktion in der DB, weil A die Zeile in B's Liste sonst
// per RLS nicht schreiben dürfte. Idempotent.
export async function addFriend(friendId) {
  const uid = await currentUserId()
  if (!uid || !friendId || friendId === uid) return
  const { error } = await supabase.rpc('add_friend_mutual', {
    target: friendId,
  })
  if (error) throw error
}

export async function removeFriend(friendId) {
  const uid = await currentUserId()
  if (!uid) return
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('owner_id', uid)
    .eq('friend_id', friendId)
  if (error) throw error
}
