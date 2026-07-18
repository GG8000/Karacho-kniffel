// Der QR-Code enthält den reinen Freund-Code (handle). Falls doch mal eine URL
// gescannt wird (z.B. später als Deep-Link), ziehen wir den Code trotzdem raus.
export function parseScannedHandle(text) {
  if (!text) return ''
  const value = text.trim()
  try {
    if (value.includes('://')) {
      const url = new URL(value)
      const fromParam = url.searchParams.get('friend')
      if (fromParam) return fromParam.trim().toLowerCase()
      const last = url.pathname.split('/').filter(Boolean).pop()
      if (last) return last.trim().toLowerCase()
    }
  } catch {
    // keine gültige URL -> als reinen Code behandeln
  }
  return value.toLowerCase()
}
