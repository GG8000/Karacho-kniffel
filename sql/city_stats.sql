-- Städte-Statistik: Stadt -> Geräte / Sitzungen / Spielzeit
--
-- Im Repo gibt es keine Migrationen; diese Datei ist die Dokumentation des
-- Schemas und wird im Supabase-SQL-Editor ausgeführt.
--
-- Datenschutz steckt hier im Datenmodell, nicht in einem Hinweistext:
--   * keine IP-Adresse, nur die daraus abgeleitete Stadt (api/session.js)
--   * kein Kontobezug, nur eine gerätelokale Zufallskennung
--   * app_sessions ist per RLS für NIEMANDEN lesbar
--   * nach außen existiert allein die View city_stats — aggregiert und ohne
--     Gerätekennungen. Die Schwelle im HAVING steht auf 1: eine Stadt ist
--     schon ab einem einzigen Gerät sichtbar (siehe Kommentar dort).

create table if not exists public.app_sessions (
  session_id     uuid primary key,          -- pro App-Start, vom Client erzeugt
  device_id      text        not null,      -- pro Gerät, localStorage; KEIN Kontobezug
  city           text,
  region         text,
  country        text,
  lat            double precision,          -- Stadt-Schwerpunkt aus der IP, kein GPS
  lng            double precision,
  active_seconds integer     not null default 0,
  started_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- Bewusst KEINE Spalte für IP-Adressen.

create index if not exists app_sessions_device_idx on public.app_sessions (device_id);
create index if not exists app_sessions_city_idx   on public.app_sessions (city);

alter table public.app_sessions enable row level security;
-- Absichtlich keine Policies: nur service_role (die Function) kommt heran.


-- Schreibpfad ------------------------------------------------------------------
--
-- Als Funktion und nicht als upsert(), weil PostgREST kein greatest() ausdrücken
-- kann: Der Client schickt immer den KUMULATIVEN Stand, und ein verspätet
-- eintreffender Beacon darf den Zähler niemals senken.

create or replace function public.record_session(
  p_session uuid,
  p_device  text,
  p_city    text,
  p_region  text,
  p_country text,
  p_lat     double precision,
  p_lng     double precision,
  p_seconds integer
) returns void
language sql
security definer
set search_path = public
as $$
  insert into app_sessions (
    session_id, device_id, city, region, country, lat, lng, active_seconds
  )
  values (
    p_session, p_device, nullif(btrim(p_city), ''), nullif(btrim(p_region), ''),
    nullif(btrim(p_country), ''), p_lat, p_lng,
    least(greatest(coalesce(p_seconds, 0), 0), 14400)  -- Plausibilitätsdeckel: 4 h
  )
  on conflict (session_id) do update
    set active_seconds = greatest(app_sessions.active_seconds, excluded.active_seconds),
        updated_at     = now();
$$;

-- Nur die Function (service_role) darf schreiben, nicht der Browser.
revoke execute on function public.record_session(
  uuid, text, text, text, text, double precision, double precision, integer
) from anon, authenticated;


-- Löschrecht (DSGVO Art. 17) ---------------------------------------------------

create or replace function public.forget_device(p_device text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from app_sessions where device_id = p_device;
$$;

revoke execute on function public.forget_device(text) from anon, authenticated;


-- Lesepfad ---------------------------------------------------------------------
--
-- Die einzige nach außen sichtbare Fläche. Die View läuft mit den Rechten ihres
-- Eigentümers (security_invoker = false, der Standard) und liest deshalb an der
-- RLS von app_sessions vorbei — genau dafür ist sie da. Supabase' Linter meldet
-- das als "security definer view"; das ist hier gewollt.
--
-- Das HAVING ist die Stellschraube für k-Anonymität und steht bewusst auf 1:
-- eine Stadt soll auch dann auf der Karte auftauchen, wenn von dort nur einmal
-- gespielt wurde. Der Preis ist, dass eine Zeile mit genau einem Gerät faktisch
-- zeigt, wie lange eine einzelne Person gespielt hat. Höher setzen (z.B. 3)
-- verbirgt das wieder, um den Preis leerer Städte am Anfang.

create or replace view public.city_stats as
  select
    city,
    country,
    avg(lat)::double precision   as lat,
    avg(lng)::double precision   as lng,
    count(distinct device_id)    as players,
    count(*)                     as sessions,
    sum(active_seconds)          as total_seconds,
    max(updated_at)              as last_seen
  from public.app_sessions
  where city is not null
    -- Nur echte Fehlstarts raus. Absichtlich niedrig: eine kurze Partie soll
    -- die Stadt schon sichtbar machen.
    and active_seconds >= 10
  group by city, country
  having count(distinct device_id) >= 1;

grant select on public.city_stats to anon, authenticated;
