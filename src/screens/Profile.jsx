import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { listFriends, removeFriend } from '../auth/friends'
import FriendCodeDialog from '../components/FriendCodeDialog'
import Spinner from '../components/Spinner'
import {
  isOptedOut,
  setOptedOut,
  browserOptOut,
  forgetDevice,
} from '../lib/geoSession'

export default function Profile({ onBack }) {
  const {
    isLoggedIn,
    profile,
    signInWithGoogle,
    signOut,
    updateDisplayName,
  } = useAuth()

  const [name, setName] = useState(profile?.display_name ?? '')
  const [qrSrc, setQrSrc] = useState(null)
  const [savingName, setSavingName] = useState(false)
  const [savedHint, setSavedHint] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [friends, setFriends] = useState([])
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [addFriendOpen, setAddFriendOpen] = useState(false)
  const [geoOn, setGeoOn] = useState(() => !isOptedOut())
  const [forgetDialog, setForgetDialog] = useState(false)
  const [forgetting, setForgetting] = useState(false)
  const [forgotten, setForgotten] = useState(false)

  // Setzt der Browser das Signal (DNT / Global Privacy Control), bewirkt der
  // Schalter nichts — das muss man dann auch dazusagen.
  const geoBlocked = browserOptOut()

  function handleGeoToggle() {
    const next = !geoOn
    setOptedOut(!next)
    setGeoOn(next)
    // Das Abschalten greift erst beim nächsten App-Start: startSessionTracking()
    // prüft nur beim Aufsetzen. Der laufende Zähler ist ohnehin schon erfasst.
  }

  async function handleForget() {
    setForgetting(true)
    setError(null)
    try {
      await forgetDevice()
      setForgetDialog(false)
      setForgotten(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setForgetting(false)
    }
  }

  function refreshFriends() {
    listFriends()
      .then(setFriends)
      .catch(() => setFriends([]))
      .finally(() => setLoadingFriends(false))
  }

  // Freunde laden + live aktualisieren: Wenn jemand dich scannt, entsteht eine
  // Zeile mit owner_id = ich → Realtime meldet sie, und die Liste aktualisiert
  // sich ohne Neuladen/Navigieren.
  useEffect(() => {
    if (!isLoggedIn || !profile?.id) {
      setFriends([])
      return
    }
    refreshFriends()

    if (!supabase) return
    const channel = supabase
      .channel(`friends:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friends',
          filter: `owner_id=eq.${profile.id}`,
        },
        () => refreshFriends(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isLoggedIn, profile?.id])

  async function handleRemoveFriend(id) {
    try {
      await removeFriend(id)
      setFriends((prev) => prev.filter((f) => f.id !== id))
    } catch (e) {
      setError(e.message ?? 'Konnte Freund nicht entfernen.')
    }
  }

  useEffect(() => {
    setName(profile?.display_name ?? '')
  }, [profile?.display_name])

  useEffect(() => {
    if (!profile?.handle) {
      setQrSrc(null)
      return
    }
    QRCode.toDataURL(profile.handle, {
      margin: 1,
      width: 220,
      color: { dark: '#1e1e1e', light: '#ffffff' },
    })
      .then(setQrSrc)
      .catch(() => setQrSrc(null))
  }, [profile?.handle])

  async function handleSaveName() {
    const value = name.trim()
    if (!value || value === profile?.display_name) return
    setSavingName(true)
    setError(null)
    try {
      await updateDisplayName(value)
      setSavedHint(true)
      setTimeout(() => setSavedHint(false), 1500)
    } catch (e) {
      setError(e.message ?? 'Konnte den Namen nicht speichern.')
    } finally {
      setSavingName(false)
    }
  }

  async function handleGoogle() {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e.message ?? 'Anmeldung fehlgeschlagen.')
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#1e1e1e',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div className="app-bar">
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: 18,
            cursor: 'pointer',
            padding: '0 8px',
          }}
        >
          ←
        </button>
        👤 KONTO
        <div style={{ width: 40 }} />
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {!isLoggedIn ? (
          <>
            <div style={{ fontSize: 40, marginTop: 24 }}>🔐</div>
            <div
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 14,
                textAlign: 'center',
                maxWidth: 320,
              }}
            >
              Du spielst gerade ohne Anmeldung. Melde dich an, damit deine
              Statistiken auf allen deinen Geräten landen.
            </div>
            <button
              className="btn-primary"
              style={{ width: '100%', maxWidth: 340 }}
              onClick={handleGoogle}
              disabled={busy}
            >
              {busy ? (
                <Spinner row label="Weiterleitung…" size={16} />
              ) : (
                'Mit Google anmelden'
              )}
            </button>
          </>
        ) : (
          <>
            {/* Spielername */}
            <div style={{ width: '100%', maxWidth: 340 }}>
              <div
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 12,
                  letterSpacing: 1,
                  marginBottom: 6,
                }}
              >
                SPIELERNAME
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="dialog-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                />
                <button
                  className="btn-outline"
                  style={{ minHeight: 44, padding: '0 16px' }}
                  onClick={handleSaveName}
                  disabled={savingName}
                >
                  {savingName ? (
                    <Spinner row size={16} />
                  ) : savedHint ? (
                    '✓'
                  ) : (
                    'Speichern'
                  )}
                </button>
              </div>
              <div
                style={{
                  color: 'rgba(255,255,255,0.3)',
                  fontSize: 11,
                  marginTop: 4,
                }}
              >
                Trage dich im Spiel genau so ein, damit die Spiele auf deine
                Statistik zählen.
              </div>
            </div>

            {/* Freund-Code + QR */}
            <div
              style={{
                width: '100%',
                maxWidth: 340,
                background: 'rgba(103,58,183,0.12)',
                border: '1px solid rgba(103,58,183,0.3)',
                borderRadius: 12,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                Dein Freund-Code
              </div>
              {qrSrc && (
                <img
                  src={qrSrc}
                  alt="Dein QR-Code"
                  width={200}
                  height={200}
                  style={{ borderRadius: 8, background: 'white', padding: 6 }}
                />
              )}
              <div
                style={{
                  color: '#b39ddb',
                  fontSize: 18,
                  fontWeight: 'bold',
                  letterSpacing: 1,
                }}
              >
                {profile?.handle ?? '…'}
              </div>
              <div
                style={{
                  color: 'rgba(255,255,255,0.35)',
                  fontSize: 11,
                  textAlign: 'center',
                }}
              >
                Lass deinen QR-Code scannen oder gib den Code weiter — dann
                landet das Spiel auch auf deiner Statistik.
              </div>
            </div>

            {/* Freunde */}
            <div style={{ width: '100%', maxWidth: 340 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 12,
                    letterSpacing: 1,
                  }}
                >
                  FREUNDE
                </div>
                <button
                  onClick={() => setAddFriendOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#b39ddb',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  ＋ Hinzufügen
                </button>
              </div>

              {loadingFriends ? (
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                  <Spinner row label="Lade Freunde…" size={16} />
                </div>
              ) : friends.length === 0 ? (
                <div
                  style={{
                    color: 'rgba(255,255,255,0.3)',
                    fontSize: 12,
                  }}
                >
                  Noch keine Freunde. Scanne im Spiel einen QR-Code oder füge sie
                  hier per Code hinzu — dann kannst du sie später ohne Scannen
                  auswählen.
                </div>
              ) : (
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  {friends.map((f) => (
                    <div
                      key={f.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: 10,
                        padding: '10px 14px',
                      }}
                    >
                      <div>
                        <div style={{ color: 'white', fontWeight: 'bold' }}>
                          {f.display_name}
                        </div>
                        <div
                          style={{
                            color: 'rgba(255,255,255,0.35)',
                            fontSize: 11,
                          }}
                        >
                          {f.handle}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFriend(f.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ff5252',
                          fontSize: 16,
                          cursor: 'pointer',
                          padding: '4px 8px',
                        }}
                        title="Entfernen"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              className="btn-outline"
              style={{ width: '100%', maxWidth: 340, marginTop: 4 }}
              onClick={() => signOut()}
            >
              Abmelden
            </button>

            {addFriendOpen && (
              <FriendCodeDialog
                takenIds={friends.map((f) => f.id)}
                onClose={() => setAddFriendOpen(false)}
                onResolve={(p) =>
                  setFriends((prev) =>
                    prev.some((f) => f.id === p.id)
                      ? prev
                      : [
                          ...prev,
                          {
                            id: p.id,
                            display_name: p.display_name,
                            handle: p.handle,
                          },
                        ].sort((a, b) =>
                          (a.display_name ?? '').localeCompare(
                            b.display_name ?? '',
                          ),
                        ),
                  )
                }
              />
            )}
          </>
        )}

        {/* Datenschutz — bewusst außerhalb des isLoggedIn-Zweigs: gezählt wird
            das Gerät, nicht das Konto, also müssen auch Gäste hier abschalten
            können. Siehe lib/geoSession.js. */}
        <div style={{ width: '100%', maxWidth: 340, marginTop: 8 }}>
          <div
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 12,
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            DATENSCHUTZ
          </div>

          <button
            onClick={handleGeoToggle}
            disabled={geoBlocked}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: 12,
              padding: '14px 16px',
              color: 'white',
              textAlign: 'left',
              cursor: geoBlocked ? 'default' : 'pointer',
              opacity: geoBlocked ? 0.5 : 1,
            }}
          >
            <span style={{ flex: 1, fontSize: 15 }}>Städte-Statistik</span>
            <span
              style={{
                width: 40,
                height: 22,
                borderRadius: 11,
                background:
                  geoOn && !geoBlocked ? '#673ab7' : 'rgba(255,255,255,0.15)',
                position: 'relative',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  left: geoOn && !geoBlocked ? 21 : 3,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  background: 'white',
                  transition: 'left 0.15s',
                }}
              />
            </span>
          </button>

          <div
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 12,
              lineHeight: 1.5,
              marginTop: 8,
            }}
          >
            {geoBlocked
              ? 'Dein Browser sendet „Do Not Track“ — es wird nichts erfasst.'
              : 'Erfasst wird die Stadt (aus der IP-Adresse abgeleitet) und die Zeit, die in der App verbracht wird. Die IP-Adresse selbst wird nicht gespeichert, und nichts davon hängt an deinem Konto. Die Stadt erscheint für alle Spieler in der Statistik — schon ab einer einzigen Partie von dort.'}
          </div>

          {!geoOn && !geoBlocked && (
            <div
              style={{
                color: 'rgba(255,255,255,0.3)',
                fontSize: 11,
                marginTop: 6,
              }}
            >
              Wirkt ab dem nächsten Start der App.
            </div>
          )}

          <button
            onClick={() => setForgetDialog(true)}
            style={{
              marginTop: 10,
              background: 'none',
              border: 'none',
              padding: 0,
              color: forgotten
                ? 'rgba(105,255,71,0.6)'
                : 'rgba(255,100,100,0.5)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {forgotten ? '✓ Gelöscht' : 'Daten dieses Geräts löschen'}
          </button>
        </div>

        {forgetDialog && (
          <div className="dialog-overlay">
            <div className="dialog">
              <div className="dialog-title">Daten dieses Geräts löschen?</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                Entfernt alle Sitzungen dieses Geräts aus der Städte-Statistik.
                Deine Spiele und dein Konto bleiben unberührt.
              </div>
              <div className="dialog-actions">
                <button
                  className="btn-outline"
                  onClick={() => setForgetDialog(false)}
                  disabled={forgetting}
                >
                  Abbrechen
                </button>
                <button
                  className="btn-danger"
                  onClick={handleForget}
                  disabled={forgetting}
                >
                  {forgetting ? <Spinner row size={16} /> : 'Löschen'}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: '#ff5252', fontSize: 13, textAlign: 'center' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
