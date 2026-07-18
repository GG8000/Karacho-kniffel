import { useEffect, useRef, useState } from 'react'

// Kamera-Scanner für Freund-Codes. html5-qrcode wird dynamisch geladen,
// damit die Scanner-Library nicht im Haupt-Bundle landet.
export default function QrScanner({ onScan, onClose }) {
  const containerId = 'qr-reader'
  const scannerRef = useRef(null)
  const doneRef = useRef(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return
        const instance = new Html5Qrcode(containerId)
        scannerRef.current = instance
        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 240 },
          (decodedText) => {
            if (doneRef.current) return
            doneRef.current = true
            onScan(decodedText)
          },
          () => {}, // Frame-Fehler ignorieren (kein Code im Bild)
        )
      } catch (e) {
        if (!cancelled) setError(e?.message ?? 'Kamera nicht verfügbar.')
      }
    })()

    return () => {
      cancelled = true
      const s = scannerRef.current
      if (s) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {})
      }
    }
  }, [])

  return (
    <div
      className="dialog-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dialog" style={{ gap: 14 }}>
        <div className="dialog-title">Freund-Code scannen</div>
        {error ? (
          <div style={{ color: '#ff5252', fontSize: 13 }}>
            {error} Erlaube der App den Kamerazugriff oder tippe den Code
            manuell ein.
          </div>
        ) : (
          <div
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 13,
            }}
          >
            Halte den QR-Code deines Freundes vor die Kamera.
          </div>
        )}
        <div
          id={containerId}
          style={{
            width: '100%',
            borderRadius: 10,
            overflow: 'hidden',
            background: '#000',
          }}
        />
        <div className="dialog-actions">
          <button className="btn-outline" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
