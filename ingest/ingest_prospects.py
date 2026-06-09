"""Ingest the 2026 prospect class.

The hand-editable CSV (ingest/data/prospects_2026.csv) is the source of truth —
edit it freely and re-run; rows upsert on (name, school) so you can tweak a
single prospect without rebuilding everything.

With --scrape, rows that have an `espn_id` get a best-effort college-stats fill
from ESPN's public JSON API (PPG/RPG/APG + shooting). Anything it can't pull is
left for you to fill in by hand.

Usage:
  python ingest/ingest_prospects.py            # import the CSV as-is
  python ingest/ingest_prospects.py --scrape   # + best-effort ESPN stat fill
"""

from __future__ import annotations

import argparse
import csv

import requests

import config
import supabase_client as sb

NUMERIC_FLOAT = {"age", "ppg", "rpg", "apg", "fg_pct", "fg3_pct", "ft_pct"}
NUMERIC_INT = {"weight"}
TEXT = {
    "name",
    "school",
    "class_year",
    "position",
    "height",
    "espn_id",
    "headshot_url",
    "projected_range",
    "notes",
}


def _clean(key: str, raw: str):
    raw = (raw or "").strip()
    if raw == "":
        return None
    if key in NUMERIC_FLOAT:
        try:
            return float(raw)
        except ValueError:
            return None
    if key in NUMERIC_INT:
        try:
            return int(float(raw))
        except ValueError:
            return None
    return raw


def read_csv() -> list[dict]:
    if not config.PROSPECTS_CSV.exists():
        raise SystemExit(f"Seed CSV not found: {config.PROSPECTS_CSV}")
    rows: list[dict] = []
    with config.PROSPECTS_CSV.open(newline="", encoding="utf-8") as fh:
        for raw in csv.DictReader(fh):
            rec = {
                k: _clean(k, raw.get(k, ""))
                for k in (NUMERIC_FLOAT | NUMERIC_INT | TEXT)
            }
            if not rec.get("name"):
                continue
            # Default a headshot URL from the ESPN id when one isn't given.
            if rec.get("espn_id") and not rec.get("headshot_url"):
                rec["headshot_url"] = config.ESPN_HEADSHOT_URL.format(
                    espn_id=rec["espn_id"]
                )
            rows.append(rec)
    return rows


def scrape_espn_stats(espn_id: str) -> dict:
    """Best-effort current-season averages from ESPN's public JSON API.

    Defensive by design: ESPN's response shape shifts, so we only set values we
    can confidently locate and silently skip the rest.
    """
    url = (
        "https://site.web.api.espn.com/apis/common/v3/sports/basketball/"
        f"mens-college-basketball/athletes/{espn_id}/stats"
    )
    try:
        resp = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:  # noqa: BLE001
        print(f"    [espn] {espn_id}: {exc}")
        return {}

    wanted = {
        "avgPoints": "ppg",
        "avgRebounds": "rpg",
        "avgAssists": "apg",
        "fieldGoalPct": "fg_pct",
        "threePointFieldGoalPct": "fg3_pct",
        "freeThrowPct": "ft_pct",
    }
    out: dict = {}
    try:
        for cat in data.get("categories", []):
            names = cat.get("names", [])
            # Use the season-average row (first stats row) when present.
            values = (cat.get("statistics") or [{}])[0].get("stats", [])
            for espn_name, our_key in wanted.items():
                if espn_name in names:
                    val = values[names.index(espn_name)]
                    try:
                        num = float(val)
                    except (TypeError, ValueError):
                        continue
                    # ESPN reports percentages 0–100; store as a 0–1 ratio.
                    if our_key.endswith("_pct"):
                        out[our_key] = round(num / 100, 3)
                    else:
                        out[our_key] = num
    except Exception as exc:  # noqa: BLE001
        print(f"    [espn] parse failed for {espn_id}: {exc}")
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--scrape",
        action="store_true",
        help="Best-effort ESPN stat fill for rows that have an espn_id.",
    )
    args = parser.parse_args()

    config.require_supabase()

    rows = read_csv()
    print(f"Read {len(rows)} prospects from {config.PROSPECTS_CSV.name}")

    if args.scrape:
        for rec in rows:
            if rec.get("espn_id"):
                print(f"  [espn] {rec['name']} ({rec['espn_id']})")
                stats = scrape_espn_stats(rec["espn_id"])
                # CSV-provided values win; only fill blanks from the scrape.
                for k, v in stats.items():
                    if rec.get(k) is None:
                        rec[k] = v

    stored = sb.upsert("prospects", rows, on_conflict="name,school")
    print(f"[supabase] upserted {len(stored)} prospects")
    print("Done. Edit the CSV and re-run any time to update the board's pool.")


if __name__ == "__main__":
    main()
