"""Shared configuration for the ingestion scripts.

Reads credentials from the environment (or a .env file at the repo root). The
service-role key is required to upsert reference data and upload headshots; keep
it server-side only.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    # Load a repo-root .env (and .env.local) if present.
    root = Path(__file__).resolve().parents[1]
    for name in (".env", ".env.local"):
        env_path = root / name
        if env_path.exists():
            load_dotenv(env_path)
except ImportError:  # python-dotenv optional
    pass

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
HEADSHOT_BUCKET = os.environ.get("SUPABASE_HEADSHOT_BUCKET", "headshots")

BBREF_USER_AGENT = os.environ.get(
    "BBREF_USER_AGENT",
    "big-board-redraft/0.1 (personal research tool)",
)

# Throttle between Basketball Reference requests (seconds). They rate limit
# hard and will 429 quickly — be a good citizen.
BBREF_SLEEP_SECONDS = float(os.environ.get("BBREF_SLEEP_SECONDS", "5"))

REDRAFT_YEARS = list(range(2016, 2026))  # 2016..2025 inclusive
PROSPECT_YEAR = 2026

DATA_DIR = Path(__file__).resolve().parent / "data"
CACHE_DIR = DATA_DIR / "cache"
HEADSHOT_DIR = DATA_DIR / "headshots"
PROSPECTS_CSV = DATA_DIR / "prospects_2026.csv"

NBA_HEADSHOT_URL = "https://cdn.nba.com/headshots/nba/latest/1040x760/{person_id}.png"
ESPN_HEADSHOT_URL = (
    "https://a.espncdn.com/i/headshots/mens-college-basketball/players/full/{espn_id}.png"
)


def require_supabase() -> None:
    """Fail fast with a helpful message if credentials are missing."""
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_SERVICE_ROLE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if missing:
        raise SystemExit(
            "Missing required environment variables: "
            + ", ".join(missing)
            + "\nCopy .env.example to .env and fill in your Supabase project values."
        )
