import { supabase, isSupabaseConfigured } from '../lib/supabase'

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
