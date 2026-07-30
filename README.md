# Setup

`.env` (Client, im Build enthalten):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Vercel-Env-Vars (nur serverseitig, **nie** mit `VITE_`-Präfix — sonst landen sie
im Client-Bundle):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

Für die Städte-Statistik muss `sql/city_stats.sql` einmal im Supabase-SQL-Editor
laufen. Lokal testen mit `npx vercel dev` (unter `npm run dev` gibt es `/api/*`
nicht) und `GEO_DEV_CITY=<Stadt>`, weil die Geo-Header nur auf Vercel ankommen.

# Improvements
1. Repeat Game with same players
2. Dropdown with already played Players
3. Kniffel Animation
4. At Laptop Key Number Input