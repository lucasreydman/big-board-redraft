-- Soft-hide for trimmed players: keep the rows (and their fetched stats) so
-- changing the cut line is a flag flip, not a re-ingestion.
alter table public.players
  add column if not exists hidden boolean not null default false;

create index if not exists players_hidden_idx
  on public.players (draft_year) where not hidden;
