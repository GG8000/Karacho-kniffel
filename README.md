# Setup

`.env` (Client, im Build enthalten):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Vercel-Env-Var (nur serverseitig, **nie** mit `VITE_`-Präfix — sonst landet der
Key im Client-Bundle):
`SUPABASE_SERVICE_ROLE_KEY` — der als `secret` markierte service_role-Key, nicht
`anon` / `sb_publishable_…`

Die Projekt-URL nimmt `api/session.js` aus `VITE_SUPABASE_URL`; ein optionales
`SUPABASE_URL` hat Vorrang, falls es gesetzt ist.

Für die Städte-Statistik muss `sql/city_stats.sql` einmal im Supabase-SQL-Editor
laufen. Lokal testen mit `npx vercel dev` (unter `npm run dev` gibt es `/api/*`
nicht) und `GEO_DEV_CITY=<Stadt>`, weil die Geo-Header nur auf Vercel ankommen.

# Improvements
- [x] **Auswahlrad statt Slider** — `components/PickerWheel.jsx`, iOS-artiges
  Rad über CSS scroll-snap. Für 3er/4er/Chance (5–30).
- [x] **Eintragen per Zell-Klick** — kein Modal mehr für den oberen Teil und
  FH/KL STR/GR STR. Oben zählt jeder Tap eine Würfelanzahl weiter: 1. Tap =
  0 Würfel (gestrichen), 6. Tap = 5 Würfel (Kniffel), 7. Tap = wieder leer.
  Zentral in `logic/kniffel.js` → `nextCellState()`.
- [x] **„-" bei drei gleichen Zahlen** — der obere Teil speichert eine Balance
  relativ zu drei Würfeln, drei gleiche sind also genau `0`. Leere Zellen
  zeigen jetzt nichts mehr, damit `-` eindeutig bleibt.
- [x] **„x" für Gestrichenes im unteren Teil** — dort heißt `value === 0`
  gestrichen (`formatCell()` in `logic/kniffel.js`).
- [x] **Kniffel-Rückfrage bei Pasch/Chance** — ist die Summe ein Vielfaches
  von 5 (5/10/…/30), kann sie aus fünf gleichen Würfeln stammen; das Sheet
  fragt per Häkchen nach und setzt `isKniffel` + Augenzahl. `kniffelFaces.js`
  wertet sie mit aus.
- [x] **Update-Modal bei jedem Öffnen** — `UpdatePrompt.jsx` lud nach festen
  3 s neu, also mitten in der Aktivierung des neuen Service Workers: die alte
  Version kam zurück, der neue Worker blieb im Wartestand und meldete sich beim
  nächsten Start erneut. Jetzt wird auf `controllerchange` gewartet, der Timer
  ist nur noch Notnagel.

Nebenbei repariert: der freie Block („~") in Kniffel Extrem war nie anklickbar
(`nextAllowed={null}` konnte nie `=== realIdx` sein), und eine durchgeklickte
Zelle wäre dort nach dem ersten Tap sofort gesperrt gewesen — editierbar sind
jetzt die nächste freie *und* die zuletzt gefüllte Zelle je Block.

Früher erledigt: 🔁 Nochmal in der Auswertung, Spieler-Vorschläge aus der
Historie (`RecentPlayersPicker`), Kniffel-Animation, Tastatureingabe am Laptop.
