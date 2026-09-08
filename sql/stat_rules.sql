-- Statistik-Regeln: Namen zusammenlegen, Spieler ausblenden
--
-- Im Repo gibt es keine Migrationen; diese Datei ist die Dokumentation des
-- Schemas und wird im Supabase-SQL-Editor ausgeführt (wie sql/city_stats.sql).
--
-- Warum eine Regel-Schicht und kein Umschreiben der Spiele:
-- Ein Spiel gehört allen Beteiligten. Würde man beim Zusammenlegen die Zeilen in
-- game_players ändern oder beim Entfernen löschen, verlören auch die Mitspieler
-- ihre Historie — für eine reine Anzeige-Entscheidung viel zu weitreichend.
-- Deshalb bleiben die Spiele unangetastet, und jeder Nutzer legt für SICH fest,
-- wie sie ausgewertet werden. Die Regeln sind damit auch jederzeit umkehrbar.
--
-- player_key ist derselbe Schlüssel wie in src/logic/stats.js keyOf():
--   "p:<profile-uuid>"  ein Account
--   "g:<name>"          ein Gast, Name kleingeschrieben

create table if not exists public.stat_rules (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  player_key text        not null,
  merge_into text,                      -- Ziel-Key, oder null
  hidden     boolean     not null default false,
  updated_at timestamptz not null default now(),

  primary key (user_id, player_key),

  -- Ein Spieler kann nicht in sich selbst aufgehen.
  constraint stat_rules_not_self
    check (merge_into is distinct from player_key),

  -- Entweder zusammenlegen oder ausblenden, nicht beides. Sonst wäre unklar,
  -- ob die Punkte beim Ziel ankommen oder verschwinden.
  constraint stat_rules_one_action
    check (merge_into is null or hidden = false),

  -- Eine Zeile ohne Wirkung wäre nur Müll: gelöscht wird die Regel, nicht
  -- auf "nichts" gesetzt.
  constraint stat_rules_has_effect
    check (merge_into is not null or hidden)
);

alter table public.stat_rules enable row level security;

-- Regeln sind privat: Sie sagen nur, wie ICH meine Statistik lesen will, und
-- gehen niemanden sonst etwas an. Deshalb vier enge Policies statt einer
-- offenen — insbesondere darf using/with check nie ohne auth.uid() auskommen.
drop policy if exists stat_rules_select on public.stat_rules;
create policy stat_rules_select on public.stat_rules
  for select using (auth.uid() = user_id);

drop policy if exists stat_rules_insert on public.stat_rules;
create policy stat_rules_insert on public.stat_rules
  for insert with check (auth.uid() = user_id);

drop policy if exists stat_rules_update on public.stat_rules;
create policy stat_rules_update on public.stat_rules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists stat_rules_delete on public.stat_rules;
create policy stat_rules_delete on public.stat_rules
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.stat_rules to authenticated;
