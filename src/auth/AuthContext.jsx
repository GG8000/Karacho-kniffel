import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AuthCtx = createContext(null)
const GUEST_KEY = 'kniffel-guest-mode'

export function useAuth() {
  return useContext(AuthCtx)
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [guest, setGuest] = useState(
    () => localStorage.getItem(GUEST_KEY) === '1',
  )

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null)
      // Wer sich anmeldet, ist kein Gast mehr — sonst würde das Gast-Flag den
      // Login-Screen nach einem späteren Abmelden überspringen.
      if (s) {
        localStorage.removeItem(GUEST_KEY)
        setGuest(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Profil laden, sobald eine Session da ist (Trigger legt es beim Registrieren an)
  useEffect(() => {
    const user = session?.user
    if (!user) {
      setProfile(null)
      return
    }
    let cancelled = false

    ;(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, handle')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (data) {
        setProfile(data)
        return
      }
      // Kein Profil (z.B. Account älter als der Trigger) -> selbst anlegen.
      // Erlaubt durch die RLS-Policy "own profile upsert".
      const base = (user.email ?? 'spieler').split('@')[0]
      const { data: created } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          display_name: base,
          handle: `${base}-${user.id.slice(0, 4)}`,
        })
        .select('id, display_name, handle')
        .single()
      if (!cancelled) setProfile(created ?? null)
    })()

    return () => {
      cancelled = true
    }
  }, [session])

  // Kein Mailversand -> kein Supabase-Mail-Ratelimit.
  // Die Session kommt nach dem Redirect zurück und wird von detectSessionInUrl
  // aufgegriffen (siehe lib/supabase.js).
  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  async function updateDisplayName(name) {
    const uid = session?.user?.id
    if (!uid) return
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim() })
      .eq('id', uid)
      .select('id, display_name, handle')
      .single()
    if (error) throw error
    setProfile(data)
  }

  function continueAsGuest() {
    localStorage.setItem(GUEST_KEY, '1')
    setGuest(true)
  }

  // Zurück zum Login-Screen: ohne das wäre der Gast-Modus eine Sackgasse.
  function exitGuest() {
    localStorage.removeItem(GUEST_KEY)
    setGuest(false)
  }

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      guest,
      isLoggedIn: Boolean(session?.user),
      configured: isSupabaseConfigured,
      signInWithGoogle,
      signOut,
      updateDisplayName,
      continueAsGuest,
      exitGuest,
    }),
    [session, profile, loading, guest],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
