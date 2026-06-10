-- Per-user cut pile for redrafts: players removed from the working board
-- (e.g. trimming to a 30-pick first round) without touching the shared pool.
alter table public.redrafts
  add column if not exists cut_player_ids jsonb not null default '[]'::jsonb;
