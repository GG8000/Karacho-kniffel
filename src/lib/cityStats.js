import { supabase, isSupabaseConfigured } from './supabase'

// Liest die aggregierte View city_stats. Die Rohtabelle app_sessions ist per RLS
// für niemanden lesbar — diese View ist die einzige Sicht nach außen, und sie
// zeigt eine Stadt erst ab drei Geräten (siehe sql/city_stats.sql).
export async function fetchCityStats() {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('city_stats')
    .select(
      'city, country, lat, lng, players, sessions, total_seconds, last_seen',
    )
    .order('total_seconds', { ascending: false })
  if (error) throw error

  return (data ?? []).map((r) => ({
    city: r.city,
    country: r.country,
    lat: r.lat,
    lng: r.lng,
    players: r.players ?? 0,
    sessions: r.sessions ?? 0,
    totalSeconds: r.total_seconds ?? 0,
    lastSeen: r.last_seen,
  }))
}

// "14h 20m" / "9m" / "42s"
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds ?? 0))
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}
