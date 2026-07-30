// Ordnet dem App-Zustand einen URL-Pfad zu.
//
// Die App hat keinen Router — ohne echte Pfade sieht Vercel Web Analytics pro
// Sitzung genau einen Seitenaufruf auf "/". Man wüsste dann zwar, dass jemand
// spielt, aber nie was. Custom Events wären die naheliegende Alternative, die
// gibt es aber erst ab dem Pro-Plan. Also bekommt jeder Screen einen Pfad: Das
// Vercel-Script patcht history.pushState und feuert den Seitenaufruf von selbst,
// und im "Seiten"-Panel steht danach, was tatsächlich benutzt wird.
//
// Nebeneffekt, der genauso viel wert ist: Der Zurück-Button funktioniert damit
// erstmals in der PWA, statt die App zu schließen.

// Screens mit eigenem Return in App.jsx.
//
// Nur statische Pfade — niemals Spielernamen o.Ä. in die URL, die stünden sonst
// dauerhaft im Dashboard.
const SCREEN_PATHS = {
  modeSelect: '/',
  lucky: '/lucky',
  extrem: '/extrem',
  stats: '/stats',
  profile: '/profile',
  online: '/online',
}

// 'normal' hat in App.jsx keinen eigenen Return — es fällt bis zum Spielbrett
// durch. Deshalb steht es hier separat und nicht in SCREEN_PATHS.
const GAME_PATH = '/normal'

// Der wichtigste Pfad: /ergebnis gegen /normal gehalten zeigt, wie viele
// angefangene Spiele auch zu Ende gespielt werden. Ohne Custom Events ist das
// die einzige Möglichkeit, das überhaupt zu zählen.
const RESULT_PATH = '/ergebnis'

const PATH_SCREENS = {
  ...Object.fromEntries(
    Object.entries(SCREEN_PATHS).map(([screen, path]) => [path, screen]),
  ),
  [GAME_PATH]: 'normal',
}

// Auth-Pfade ergeben sich aus dem Anmeldestatus, nicht aus einer Navigation.
// Sie dürfen deshalb keinen History-Eintrag anlegen: Sonst landet man beim
// Zurücktippen wieder auf /login, wird sofort weitergeschoben und sitzt fest.
const TRANSIENT_PATHS = new Set(['/login', '/profil-einrichten'])

// Spiegelt die Return-Kette aus App.jsx. Wer dort einen Screen einfügt, muss
// ihn auch hier eintragen — sonst zählt er im Dashboard als Spielbrett.
// Gibt null zurück, solange nur ein Ladebildschirm sichtbar ist: Diese
// Durchgangszustände würden die Statistik nur mit Rauschen füllen.
export function pathForState({
  loading,
  authLoading,
  isLoggedIn,
  guest,
  profile,
  nameConfirmed,
  screen,
  showResult,
}) {
  if (loading || authLoading) return null
  if (!isLoggedIn && !guest) return '/login'
  if (isLoggedIn && profile && !nameConfirmed) return '/profil-einrichten'
  if (SCREEN_PATHS[screen]) return SCREEN_PATHS[screen]
  if (showResult) return RESULT_PATH
  return GAME_PATH
}

// Gegenrichtung für den Zurück-Button. Unbekannte Pfade (z.B. ein direkt
// aufgerufenes /ergebnis) landen sicherheitshalber in der Modus-Auswahl.
export function screenForPath(path) {
  return PATH_SCREENS[path] ?? 'modeSelect'
}

export function isTransientPath(path) {
  return TRANSIENT_PATHS.has(path)
}
