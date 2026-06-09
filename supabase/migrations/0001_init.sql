-- ===========================================================================
-- Big Board / Redraft — initial schema
--
-- Reference data (players, career_stats, prospects) is world-readable so the
-- app can render any draft class. It is only written by the ingestion scripts
-- using the service-role key, which bypasses RLS.
--
-- User data (redrafts, big_boards) is private and scoped to the owner via RLS.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- players: one row per drafted player, joined across nba_api + BBRef
-- ---------------------------------------------------------------------------
create table if not exists public.players (
  id             uuid primary key default gen_random_uuid(),
  nba_person_id  bigint,
  bbref_slug     text,
  name           text not null,
  draft_year     int  not null,
  overall_pick   int  not null,
  round_number   int,
  team           text,
  college        text,
  headshot_url   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (draft_year, overall_pick)
);

create index if not exists players_draft_year_idx on public.players (draft_year);
create index if not exists players_nba_person_id_idx on public.players (nba_person_id);

-- ---------------------------------------------------------------------------
-- career_stats: one row per player (career aggregates / advanced metrics)
-- All stat columns are nullable: plenty of picks have tiny or zero careers.
-- ---------------------------------------------------------------------------
create table if not exists public.career_stats (
  player_id  uuid primary key references public.players (id) on delete cascade,
  gp         int,
  mpg        numeric(5,2),
  ppg        numeric(5,2),
  rpg        numeric(5,2),
  apg        numeric(5,2),
  spg        numeric(5,2),
  bpg        numeric(5,2),
  fg_pct     numeric(5,3),
  fg3_pct    numeric(5,3),
  ft_pct     numeric(5,3),
  ts_pct     numeric(5,3),
  ws         numeric(7,2),
  ws48       numeric(6,3),
  bpm        numeric(6,2),
  vorp       numeric(7,2),
  seasons    int,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- prospects: 2026 class. Seeded from a hand-editable CSV + best-effort scrape.
-- ---------------------------------------------------------------------------
create table if not exists public.prospects (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  school          text,
  class_year      text,
  position        text,
  height          text,
  weight          int,
  age             numeric(4,1),
  ppg             numeric(5,2),
  rpg             numeric(5,2),
  apg             numeric(5,2),
  fg_pct          numeric(5,3),
  fg3_pct         numeric(5,3),
  ft_pct          numeric(5,3),
  espn_id         text,
  headshot_url    text,
  projected_range text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (name, school)
);

-- ---------------------------------------------------------------------------
-- redrafts: a user's reordered class. One row per (user, draft_year).
-- ---------------------------------------------------------------------------
create table if not exists public.redrafts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  draft_year         int  not null,
  ordered_player_ids jsonb not null default '[]'::jsonb,
  updated_at         timestamptz not null default now(),
  unique (user_id, draft_year)
);

create index if not exists redrafts_user_idx on public.redrafts (user_id);

-- ---------------------------------------------------------------------------
-- big_boards: a user's 2026 board with tiers + per-prospect notes.
-- ---------------------------------------------------------------------------
create table if not exists public.big_boards (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  name                 text not null default 'My 2026 Big Board',
  ordered_prospect_ids jsonb not null default '[]'::jsonb,
  tiers                jsonb not null default '[]'::jsonb,
  notes                jsonb not null default '{}'::jsonb,
  updated_at           timestamptz not null default now()
);

create index if not exists big_boards_user_idx on public.big_boards (user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['players','career_stats','prospects','redrafts','big_boards']
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I; '
      'create trigger set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at();', t, t);
  end loop;
end $$;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.players      enable row level security;
alter table public.career_stats enable row level security;
alter table public.prospects    enable row level security;
alter table public.redrafts     enable row level security;
alter table public.big_boards   enable row level security;

-- Reference data: readable by everyone (anon + authenticated). Writes only via
-- the service role, which bypasses RLS, so no insert/update policies needed.
drop policy if exists "players readable" on public.players;
create policy "players readable" on public.players
  for select using (true);

drop policy if exists "career_stats readable" on public.career_stats;
create policy "career_stats readable" on public.career_stats
  for select using (true);

drop policy if exists "prospects readable" on public.prospects;
create policy "prospects readable" on public.prospects
  for select using (true);

-- redrafts: owner-only full access.
drop policy if exists "redrafts owner" on public.redrafts;
create policy "redrafts owner" on public.redrafts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- big_boards: owner-only full access.
drop policy if exists "big_boards owner" on public.big_boards;
create policy "big_boards owner" on public.big_boards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===========================================================================
-- Storage bucket for mirrored headshots (public read).
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('headshots', 'headshots', true)
on conflict (id) do nothing;

drop policy if exists "headshots public read" on storage.objects;
create policy "headshots public read" on storage.objects
  for select using (bucket_id = 'headshots');
