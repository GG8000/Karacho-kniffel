// Nimmt Sitzungsdauern an und ordnet ihnen die Stadt zu, die Vercel aus der IP
// ableitet. Serverless Function, weil die x-vercel-ip-*-Header nur hier
// ankommen: Der Client könnte die Stadt sonst nur über einen Drittanbieter
// besorgen — der dann die IP jedes Spielers zu sehen bekäme.
//
// Die IP wird hier nie gespeichert und nie geloggt, nur die daraus abgeleitete
// Stadt. Einen Kontobezug gibt es auch nicht: der Client schickt eine
// gerätelokale Zufallskennung, kein Token. Siehe sql/city_stats.sql.

import { createClient } from '@supabase/supabase-js'

// Ohne VITE_-Präfix — diese beiden dürfen nie im Client-Bundle landen und
// gehören ausschließlich in die Vercel-Env-Vars.
const DB_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Vercel liefert die Stadt URL-kodiert ("Sankt%20Johann").
function header(req, name) {
  const raw = req.headers[name]
  if (typeof raw !== 'string') return null
  let value = raw
  try {
    value = decodeURIComponent(raw)
  } catch {
    // kaputte Kodierung -> Rohwert nehmen
  }
  return value.trim() || null
}

function asNumber(raw) {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

// sendBeacon schickt einen Blob; je nach Content-Type parst Vercel den Body
// selbst oder eben nicht.
function parseBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return null
    }
  }
  return req.body && typeof req.body === 'object' ? req.body : null
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  if (!DB_URL || !SERVICE_KEY) {
    console.error('session: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen')
    // Nach außen still: der Client kann daran nichts ändern und soll deswegen
    // nicht in eine Fehlerbehandlung laufen.
    return res.status(204).end()
  }

  // Einmal-Diagnose nach dem ersten Deploy: zeigt in den Function-Logs, welche
  // Geo-Header der aktive Vercel-Plan wirklich liefert. Der Filter auf
  // x-vercel-ip- lässt die IP-Header (x-forwarded-for, x-real-ip) bewusst weg.
  if (process.env.GEO_DEBUG === '1') {
    const geo = Object.fromEntries(
      Object.entries(req.headers).filter(([k]) => k.startsWith('x-vercel-ip-')),
    )
    console.log('session geo-header:', JSON.stringify(geo))
  }

  const data = parseBody(req)
  const device = typeof data?.deviceId === 'string' ? data.deviceId : ''
  if (!UUID.test(device)) return res.status(400).end()

  const db = createClient(DB_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    // Löschrecht (DSGVO Art. 17): alles zu diesem Gerät entfernen.
    if (data.forget === true) {
      const { error } = await db.rpc('forget_device', { p_device: device })
      if (error) throw error
      return res.status(204).end()
    }

    const session = typeof data.sessionId === 'string' ? data.sessionId : ''
    const seconds = asNumber(data.activeSeconds)
    if (!UUID.test(session) || seconds === null) return res.status(400).end()

    // GEO_DEV_CITY: unter `vercel dev` gibt es keine Geo-Header.
    const city =
      header(req, 'x-vercel-ip-city') ?? process.env.GEO_DEV_CITY ?? null

    const { error } = await db.rpc('record_session', {
      p_session: session,
      p_device: device,
      p_city: city,
      p_region: header(req, 'x-vercel-ip-country-region'),
      p_country: header(req, 'x-vercel-ip-country'),
      p_lat: asNumber(header(req, 'x-vercel-ip-latitude')),
      p_lng: asNumber(header(req, 'x-vercel-ip-longitude')),
      p_seconds: Math.round(seconds),
    })
    if (error) throw error

    return res.status(204).end()
  } catch (e) {
    // Nur die Meldung — nie das Request-Objekt, das enthielte die IP.
    console.error('session:', e?.message ?? e)
    return res.status(500).end()
  }
}
