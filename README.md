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

- [x] **Fehltipp-Schutz beim Zell-Klick** — ein Tap auf eine schon gefüllte
  Zelle markiert sie nur noch (oranger Rahmen), erst der zweite ändert.
  `lib/useArmedCell.js`; die gerade durchgeklickte Zelle bleibt 3 s scharf,
  damit 0→1→2→3→4→5 Würfel in einem Rutsch geht. Dazu ein Toast mit
  „Rückgängig" (`lib/toast.js`, gerendert vom `Toaster`).
- [x] **Kein Zwangssprung in die Auswertung** — die letzte Zelle machte den
  Block schon beim ERSTEN Tap voll (0 Würfel = gestrichen), worauf sich die
  Auswertung drüberschob und das Weitertippen unmöglich wurde. `App.jsx` zeigt
  jetzt wie die anderen beiden Modi nur den `AUSWERTEN →`-Button. `gameComplete`
  ist dabei von State zu abgeleitet geworden — es wurde ohnehin nur an einer
  Stelle gelesen, und der `setTimeout` aus dem `setScores`-Updater fällt weg.
- [x] **Länderumrisse auf der Städte-Karte** — `CityMap.jsx` zeichnete nur ein
  Gradnetz, übrig blieb ein leerer Kasten mit Punkten. Die Umrisse liegen jetzt
  in `lib/worldLand.js`, erzeugt von `scripts/build-world.mjs` aus world-atlas
  (Natural Earth 110m, public domain, nur devDependency — zur Laufzeit wird
  nichts nachgeladen). `MIN_SPAN_DEG` von 8 auf 30, sonst ist der Ausschnitt bei
  zwei Städten im selben Land zu eng, um etwas wiederzuerkennen.

- [x] **Namen zusammenlegen und aus der Statistik nehmen** — im Spieler-Tab
  unter „⚙ Verwalten". Derselbe Mensch taucht sonst doppelt auf (einmal als
  Gast-Name, einmal als Account), und Testspieler stehen für immer in der
  Rangliste. Die Spiele selbst werden dabei NICHT angefasst: Ein Spiel gehört
  allen Beteiligten, ein Umschreiben oder Löschen träfe auch die Mitspieler.
  Stattdessen legt jeder für sich Regeln fest (`sql/stat_rules.sql`, pro Konto
  und per RLS privat), die `logic/applyStatRules.js` über die Historie legt,
  bevor irgendein Aggregator sie sieht — deshalb wirken sie in Rangliste,
  Head-to-Head, Kategorien, Reihenfolge und Monatsrückblick gleichermaßen, ohne
  dass einer davon etwas davon wissen muss. Alles jederzeit umkehrbar.

- [x] **Ranglistenpunkte in der Auswertung** — das Rating stand bisher nur in
  der Statistik, also nirgends dort, wo es entsteht. Jede Ergebniskarte zeigt
  jetzt `vorher → nachher` und den Zuwachs, in allen vier Modi. Gerechnet wird
  in `logic/ratingPreview.js` mit ZWEI Durchläufen von `computeStats()` — einmal
  ohne, einmal mit dem neuen Spiel. Dadurch bleibt die ELO-Formel an genau einer
  Stelle, und der Nachher-Wert stimmt exakt mit dem überein, was die Rangliste
  nach dem Speichern zeigt. `lib/useRatingPreview.js` legt vorher dieselben
  Statistik-Regeln darüber wie die Statistik selbst, sonst wichen
  zusammengelegte Spieler ab. Online ist das Spiel beim Auswerten schon
  geschrieben — dort wird es für den Vorher-Stand wieder herausgerechnet.
- [x] **Animation beim Streichen** — Gegenstück zur Kniffel-Feier, gleicher
  Aufbau: ein Kanal (`lib/strike.js`) und ein global gemounteter Empfänger
  (`StrikeAnimation.jsx` in `main.jsx`). Heikel war der obere Teil: dort IST die
  Streichung der erste Tap beim Durchklicken 0→1→2→3→4→5, eine sofortige
  Animation hätte bei jedem Eintrag geknallt. `armStrike()` wartet deshalb oben
  0,7 s ab, ob die Zelle wirklich auf null Würfeln stehen bleibt; der nächste
  Tap und „Rückgängig" nehmen sie zurück. Unten ist Streichen eine bewusste
  Eingabe und knallt sofort. Online zählt erst „Zug bestätigen", nicht der Tap.

- [x] **Punkte gesamt und Punktebilanz je Gegner** — im Spielerdetail steht
  jetzt die Summe aller je erreichten Punkte (`sumScore` wurde in `stats.js`
  ohnehin schon für den Schnitt gebildet, nur nie angezeigt), und Head-to-Head
  zeigt neben dem Siegstand die Punkte beider Seiten aus den gemeinsamen
  Spielen. Beides bekommt eine eigene Farbe, weil es auseinandergehen kann:
  viele knappe Siege schlagen wenige hohe. Bewusst KEINE Aufteilung von
  `sumScore` — bei drei Mitspielern zählt dasselbe Ergebnis gegen jeden von
  ihnen, die Zahl beantwortet „wie viel habe ich gegen DEN gespielt".

- [x] **Anleitung in der App** — der obere Teil führt eine BALANCE statt
  absoluter Punkte, und das sieht man ihm nicht an: „−" heißt „genau drei",
  nicht „null". Wer nur gelegentlich mitspielt, musste sich das bisher erklären
  lassen. `components/Guide.jsx` erklärt genau das plus die Bedienung der
  Zellen; erreichbar über den „?"-Knopf in jeder Spielansicht und einmalig beim
  ersten Start (`kniffel-guide-seen-v1`). Kanal `lib/guide.js` nach demselben
  Muster wie `toast.js` — sonst müsste der Offen-Zustand durch vier Screens
  gefädelt werden, die sonst nichts miteinander zu tun haben. Die
  Beispielzellen laufen durch `formatCell()` aus `logic/kniffel.js`, also durch
  dieselbe Funktion wie der echte Block: so kann die Anleitung nicht
  auseinanderlaufen, wenn sich die Darstellung ändert.

- [x] **Bilanz über der Rangliste** — die Punktebilanz gegen jeden Gegner gab es
  schon, aber nur im Spielerdetail: man musste sich erst selbst antippen.
  Jetzt steht sie über der Rangliste, gerendert vom vorhandenen
  `HeadToHeadMatrix` — eine zweite Einbaustelle, keine zweite Darstellung.
  Angemeldet ist „ich" das eigene Konto (`keyOf` über die profileId), als Gast
  einmal auswählbar (`kniffel-me-key-v1`). Kein fünfter Tab: bei vier wird die
  Zeile am Handy schon eng.
- [x] **Filz & Messing statt Lila/Schwarz im Block** — die Spaltenköpfe standen
  auf `#673ab7` mit SCHWARZER Schrift, Kontrast 2,7:1 bei einem Minimum von
  4,5:1. Der Block ist jetzt eine eigene Fläche — dunkelgrüner Filz, Messing für
  die Köpfe (7,9:1), Creme für die Zahlen (10,4:1). App-Bar, Menü und Statistik
  behalten ihr Lila. Das Bonus-Grün musste weichen (grün auf grünem Filz trägt
  nicht): SUMME schlägt jetzt von Rot auf helles Messing um. Nebenbei zwei
  Doppelbelegungen aufgelöst — der Kniffel-Ring hat sich sein Orange bisher mit
  dem Fehltipp-Schutz geteilt, und im Extrem-Block stand dieselbe Farbe für
  „scharf" und „nächste Zelle". Die Palette liegt als CSS-Variablen in `:root`,
  weil die Blockfarben teils in `App.css` und teils inline in drei Komponenten
  stehen; die Kontrastwerte stehen als Kommentar dabei. Die Anleitung zieht mit
  — sie sagte wörtlich „wird grün, sobald der Bonus sicher ist".
- [x] **Block in den Farben der App** — Filz und Messing hatten den Kontrast
  repariert, sahen aber aus wie eine andere App. Der Block steht jetzt auf
  demselben dunklen Grau wie Hintergrund und App-Bar, die Spaltenköpfe sind Lila
  wie die Buttons — diesmal mit WEISSER Schrift (7,3:1). SUMME schlägt wieder
  von Rot auf Grün um (dieselben Farben wie `RatingDelta`). TOTAL und die
  nächste Zelle im Extrem-Block stehen in hellem Lila `#b388ff`, weil `#673ab7`
  als Schrift auf Dunkel nur 2,6:1 hätte. Ziffern sind gleich breit
  (`tabular-nums`). Die Tokens heißen jetzt `--sheet-*` statt `--felt`/`--brass`,
  die Kontrastwerte stehen weiter als Kommentar in `App.css`.
- [x] **Kniffel-Feier im oberen Teil verzögert** — dort ist „fünf Würfel" der
  sechste Tap beim Durchklicken. Wer einen zu weit kam, bekam die volle
  Bildschirmfeier für etwas, das er gleich wieder wegtippte. Die Bedenkzeit aus
  der Streich-Animation ist nach `lib/pendingCell.js` gewandert und trägt jetzt
  beide: EIN Timer je Zelle für alle Ereignisarten, denn eine Zelle kann nicht
  gleichzeitig gestrichen und Kniffel sein. Das Sheet bleibt sofort (bewusste
  Bestätigung), und im Online-Modus feuert jetzt auch die Feier erst mit „Zug
  bestätigen" statt beim Antippen — wie die Streichung.

Nebenbei repariert: der freie Block („~") in Kniffel Extrem war nie anklickbar
(`nextAllowed={null}` konnte nie `=== realIdx` sein), und eine durchgeklickte
Zelle wäre dort nach dem ersten Tap sofort gesperrt gewesen — editierbar sind
jetzt die nächste freie *und* die zuletzt gefüllte Zelle je Block.

Früher erledigt: 🔁 Nochmal in der Auswertung, Spieler-Vorschläge aus der
Historie (`RecentPlayersPicker`), Kniffel-Animation, Tastatureingabe am Laptop.
