-- ===========================================================================
-- TMN Aggregator — autonomous NBA content pipeline
--
-- All tables live in the existing project under the `agg_` prefix, fully
-- isolated from the Big Board / Redraft tables. They are only ever read or
-- written server-side with the service-role key (which bypasses RLS).
--
-- RLS is enabled with NO policies on every table: the anon / authenticated
-- keys (which the rest of the app uses client-side) cannot read or write any
-- aggregator data. Defense in depth for a shared project.
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- agg_sources: owner-curated ingestion sources
-- ---------------------------------------------------------------------------
create table if not exists public.agg_sources (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            text not null check (type in ('rss','reddit','youtube','google_news')),
  url             text not null,
  weight          numeric not null default 1.0,   -- score multiplier for trusted sources
  is_active       boolean not null default true,
  last_fetched_at timestamptz,
  failure_count   int not null default 0,         -- auto-deactivate after 10 consecutive failures
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- agg_items: ingested content items, one row per deduped story
-- ---------------------------------------------------------------------------
create table if not exists public.agg_items (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid references public.agg_sources (id) on delete set null,
  url          text not null,
  url_hash     text not null unique,             -- SHA-256 of the canonical URL
  title        text not null,
  summary      text,
  source_text  text,                             -- extracted article text (draft + verify input)
  published_at timestamptz,
  status       text not null default 'new' check (status in
    ('new','rejected_score','scored','drafted','rejected_verify',
     'queued','posted','failed','expired')),
  score        numeric,
  score_reason text,
  draft_text   text,
  verify_reason text,
  tweet_id     text,
  posted_at    timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists agg_items_status_idx
  on public.agg_items (status, score desc, created_at);
create index if not exists agg_items_created_idx
  on public.agg_items (created_at desc);
create index if not exists agg_items_title_trgm
  on public.agg_items using gin (title gin_trgm_ops);
create index if not exists agg_items_draft_trgm
  on public.agg_items using gin (draft_text gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- agg_quota: monthly X post quota tracking
-- ---------------------------------------------------------------------------
create table if not exists public.agg_quota (
  month      text primary key,                    -- e.g. '2026-06'
  posts_used int not null default 0,
  cap        int not null default 450
);

-- ---------------------------------------------------------------------------
-- agg_config: thresholds, pacing, surge, kill switch, prompts
-- ---------------------------------------------------------------------------
create table if not exists public.agg_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- Row Level Security: ON everywhere, with no policies. Service role only.
-- ===========================================================================
alter table public.agg_sources enable row level security;
alter table public.agg_items   enable row level security;
alter table public.agg_quota   enable row level security;
alter table public.agg_config  enable row level security;

-- ===========================================================================
-- Transactional quota helpers (run server-side via RPC)
-- ===========================================================================

-- Reserve one post for the given month. Returns true if reserved (under cap),
-- false if the cap is already reached. Atomic: upserts the row, then increments
-- only when there is headroom.
create or replace function public.agg_reserve_quota(p_month text, p_cap int)
returns boolean
language plpgsql
as $$
declare
  reserved boolean := false;
begin
  insert into public.agg_quota (month, posts_used, cap)
  values (p_month, 0, p_cap)
  on conflict (month) do nothing;

  update public.agg_quota
     set posts_used = posts_used + 1
   where month = p_month
     and posts_used < cap
  returning true into reserved;

  return coalesce(reserved, false);
end;
$$;

-- Release one reserved post (on publish failure). Never goes below zero.
create or replace function public.agg_release_quota(p_month text)
returns void
language plpgsql
as $$
begin
  update public.agg_quota
     set posts_used = greatest(posts_used - 1, 0)
   where month = p_month;
end;
$$;

-- ===========================================================================
-- Seed default config (idempotent — existing values are preserved)
-- ===========================================================================
insert into public.agg_config (key, value) values
  ('paused',          'false'::jsonb),
  ('score_threshold', '7.5'::jsonb),
  ('min_gap_minutes', '45'::jsonb),
  ('max_per_hour',    '2'::jsonb),
  ('quota_cap',       '450'::jsonb),
  ('surge',           '{"on": false, "expires_at": null}'::jsonb)
on conflict (key) do nothing;

-- ===========================================================================
-- Seed a starter set of sources (idempotent on url)
-- ===========================================================================
insert into public.agg_sources (name, type, url, weight) values
  ('ESPN NBA',            'rss',    'https://www.espn.com/espn/rss/nba/news',              1.2),
  ('Yahoo NBA',           'rss',    'https://sports.yahoo.com/nba/rss/',                   1.0),
  ('CBS Sports NBA',      'rss',    'https://www.cbssports.com/rss/headlines/nba/',        1.0),
  ('HoopsHype',           'rss',    'https://hoopshype.com/feed/',                         0.9),
  ('r/nba',               'reddit', 'https://www.reddit.com/r/nba/hot.json?limit=50',      0.9),
  ('r/nbadiscussion',     'reddit', 'https://www.reddit.com/r/nbadiscussion/hot.json?limit=25', 1.0)
on conflict do nothing;
