# Big Board / Redraft

A personal terminal for studying NBA draft classes.

- **Redraft mode** — every completed class, 2016–2025. Loads the real draft
  order, headshots, and full career stats. Drag rows to build your own redraft
  and watch how far each player moves from where he actually went.
- **Big board mode** — the 2026 prospects with their college numbers and
  headshots. Drag them into your own ranking, drop in tier dividers, and keep
  notes.

Everything auto-saves, scoped to you via Supabase auth + RLS.

```
.
├── src/                 # Next.js 16 App Router web app (React 19, Tailwind 4)
├── supabase/migrations/ # schema, RLS, storage bucket
└── ingest/              # Python data ingestion (kept out of the web app)
```

---

## Stack

- Next.js 16 App Router · React 19 · TypeScript · Tailwind 4
- Supabase — Postgres, auth, and a public `headshots` storage bucket
- dnd-kit — sortable drag-and-drop rows
- html-to-image — PNG export
- pnpm
- Python (nba_api, requests, pandas, beautifulsoup4) for ingestion

---

## 1. Supabase setup

1. Create a Supabase project.
2. Run the migration in `supabase/migrations/0001_init.sql` (paste it into the
   SQL editor, or `supabase db push` with the CLI). It creates the tables, RLS
   policies, the `updated_at` triggers, and the public `headshots` bucket.
3. In **Authentication → Providers**, enable Email. For password sign-in you can
   turn off email confirmation while it's just you; for magic links leave email
   confirmation on and make sure the redirect URL allows
   `http://localhost:3000/auth/callback`.

Reference data (`players`, `career_stats`, `prospects`) is world-readable so the
app can render any class. It's only ever written by the ingestion scripts using
the service-role key. Your `redrafts` and `big_boards` are private to your user.

## 2. Web app

```bash
pnpm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL + ANON_KEY
pnpm dev                     # http://localhost:3000
```

`pnpm build` for a production build, `pnpm typecheck` for types.

## 3. Ingestion

```bash
cd ingest
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (read from repo-root .env)
```

**Historical classes (2016–2025)** — joins nba_api `DraftHistory` (pick order +
person ids) with the Basketball Reference draft page (career + advanced metrics)
on `(draft_year, overall_pick)`, with a name match as a fallback:

```bash
python ingest_historical.py                # all years
python ingest_historical.py --years 2016 2019
python ingest_historical.py --fill-nba     # also pull SPG/BPG/TS% (slow)
```

BBRef rate limits hard, so the scraper does one request per year, sleeps between
them (`BBREF_SLEEP_SECONDS`), sends a real User-Agent, and caches the raw HTML
under `ingest/data/cache/` — re-runs never re-hit them. Use `--force-bbref` to
refresh the cache.

**2026 prospects** — `ingest/data/prospects_2026.csv` is the hand-editable
source of truth (upserts on `name, school`, so you can edit one prospect and
re-run):

```bash
python ingest_prospects.py            # import the CSV
python ingest_prospects.py --scrape   # + best-effort ESPN stat fill (needs espn_id)
```

**Headshots** — the app hotlinks the CDN URLs by default. To mirror them into
the storage bucket and repoint at the durable copies:

```bash
python download_headshots.py            # players + prospects
python download_headshots.py --players
```

Missing / 404 images are skipped; the UI shows a silhouette fallback for anyone
without a working headshot.

---

## Notes on data

- Plenty of post-2016 picks have tiny or zero NBA careers. They're kept in the
  redraft with empty (—) stats rather than dropped.
- Shooting percentages are stored as 0–1 ratios and rendered as `.xxx`.
- Tier dividers in the big board are fixed slots: dragging a prospect across a
  divider moves him between tiers.
- In the redraft table, clicking a stat header sorts by that column as a
  transient lens; dragging any row commits that arrangement as your saved order.
