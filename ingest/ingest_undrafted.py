"""Add the best undrafted players from each class (2016–2025).

Pipeline:
  1. nba_api PlayerIndex (historical) → undrafted players, class = FROM_YEAR
  2. Shortlist per class by career span + current scoring, then pull real
     career totals (PlayerCareerStats) for each shortlisted candidate
  3. Keep the top N per class by career points (with a GP floor that relaxes
     for recent classes)
  4. Best-effort Basketball Reference scrape for career WS/WS48/BPM/VORP so
     UDFAs are comparable in the value columns (throttled + cached)
  5. Upsert into players (sentinel overall_pick 101, 102, … per class) and
     career_stats

Usage:
  python ingest/ingest_undrafted.py            # all classes, top 8 each
  python ingest/ingest_undrafted.py --per-class 8 --years 2016 2017
"""

from __future__ import annotations

import argparse
import json
import math
import re
import time

import requests
from bs4 import BeautifulSoup

import config
import supabase_client as sb

UDFA_PICK = 100  # sentinel base; rank i within a class → 100 + i

UA = {"User-Agent": config.BBREF_USER_AGENT}

# GP floor: enough NBA run to be worth a redraft slot. Recent classes have had
# fewer possible games, so the floor relaxes.
GP_FLOOR = {2023: 60, 2024: 30, 2025: 15}
DEFAULT_GP_FLOOR = 100


def fetch_undrafted_index():
    from nba_api.stats.endpoints import playerindex

    raw = json.loads(
        playerindex.PlayerIndex(
            historical_nullable=1, league_id="00", season="2025-26"
        ).get_json()
    )
    rs = raw["resultSets"][0]
    idx = {h: i for i, h in enumerate(rs["headers"])}
    out = []
    for row in rs["rowSet"]:
        if row[idx["DRAFT_NUMBER"]]:
            continue
        try:
            from_year = int(row[idx["FROM_YEAR"]])
            to_year = int(row[idx["TO_YEAR"]])
        except (TypeError, ValueError):
            continue
        if not (2016 <= from_year <= 2025):
            continue
        out.append(
            {
                "person_id": int(row[idx["PERSON_ID"]]),
                "name": f"{row[idx['PLAYER_FIRST_NAME']]} {row[idx['PLAYER_LAST_NAME']]}".strip(),
                "college": row[idx["COLLEGE"]] or None,
                "class_year": from_year,
                "span": to_year - from_year,
                "recent_ppg": float(row[idx["PTS"]] or 0),
            }
        )
    return out


def career_line(person_id: int) -> dict | None:
    """Career totals → the career_stats row shape (no BBRef advanced yet)."""
    from nba_api.stats.endpoints import playercareerstats

    try:
        raw = json.loads(
            playercareerstats.PlayerCareerStats(player_id=person_id).get_json()
        )
    except Exception as exc:  # noqa: BLE001
        print(f"    career fetch failed for {person_id}: {exc}")
        return None
    sets = {s.get("name"): s for s in raw.get("resultSets", [])}
    career = sets.get("CareerTotalsRegularSeason")
    if not career or not career.get("rowSet"):
        return None
    r = dict(zip(career["headers"], career["rowSet"][0]))
    seasons_rs = sets.get("SeasonTotalsRegularSeason")
    seasons = len({row[1] for row in (seasons_rs or {}).get("rowSet", [])}) or None

    def f(key: str) -> float:
        try:
            v = float(r.get(key) or 0)
            return v if math.isfinite(v) else 0.0
        except (TypeError, ValueError):
            return 0.0

    gp = f("GP")
    if not gp:
        return None
    out = {
        "gp": int(gp),
        "seasons": seasons,
        "mpg": round(f("MIN") / gp, 1),
        "ppg": round(f("PTS") / gp, 1),
        "rpg": round(f("REB") / gp, 1),
        "apg": round(f("AST") / gp, 1),
        "spg": round(f("STL") / gp, 2),
        "bpg": round(f("BLK") / gp, 2),
        "total_pts": f("PTS"),
    }
    if f("FGA"):
        out["fg_pct"] = round(f("FGM") / f("FGA"), 3)
    if f("FG3A"):
        out["fg3_pct"] = round(f("FG3M") / f("FG3A"), 3)
    if f("FTA"):
        out["ft_pct"] = round(f("FTM") / f("FTA"), 3)
    denom = 2 * (f("FGA") + 0.44 * f("FTA"))
    if denom:
        out["ts_pct"] = round(f("PTS") / denom, 3)
    return out


# ---------------------------------------------------------------------------
# Basketball Reference career advanced (WS, WS/48, BPM, VORP) — best effort.
# ---------------------------------------------------------------------------


def bbref_player_html(name: str) -> str | None:
    cache = config.CACHE_DIR / f"bbref_player_{re.sub(r'[^a-z0-9]+', '-', name.lower())}.html"
    if cache.exists():
        return cache.read_text(encoding="utf-8", errors="replace")
    url = "https://www.basketball-reference.com/search/"
    try:
        time.sleep(config.BBREF_SLEEP_SECONDS)
        resp = requests.get(url, params={"search": name}, headers=UA, timeout=30)
        if resp.status_code != 200:
            print(f"    bbref search {resp.status_code} for {name}")
            return None
        html = resp.text
        # If we landed on a results page, follow the first player hit.
        if "/players/" in resp.url:
            pass  # unique match redirected straight to the player page
        else:
            m = re.search(r'href="(/players/[a-z]/\w+\.html)"', html)
            if not m:
                print(f"    bbref: no player result for {name}")
                return None
            time.sleep(config.BBREF_SLEEP_SECONDS)
            resp = requests.get(
                f"https://www.basketball-reference.com{m.group(1)}",
                headers=UA,
                timeout=30,
            )
            if resp.status_code != 200:
                return None
            html = resp.text
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(html, encoding="utf-8")
        return html
    except Exception as exc:  # noqa: BLE001
        print(f"    bbref fetch failed for {name}: {exc}")
        return None


def bbref_advanced(name: str) -> dict:
    html = bbref_player_html(name)
    if not html:
        return {}
    # BBRef hides some tables inside HTML comments; expose them all.
    html = html.replace("<!--", "").replace("-->", "")
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", id="advanced")
    if not table:
        return {}
    # The career aggregate is the first tfoot row; BBRef labels it "N Yrs"
    # (it used to say "Career").
    tfoot = table.find("tfoot")
    career_row = tfoot.find("tr") if tfoot else None
    if not career_row:
        return {}
    out = {}
    for stat, col in (("ws", "ws"), ("ws48", "ws_per_48"), ("bpm", "bpm"), ("vorp", "vorp")):
        cell = career_row.find("td", attrs={"data-stat": col})
        if cell:
            try:
                v = float(cell.get_text(strip=True))
                if math.isfinite(v):
                    out[stat] = v
            except ValueError:
                pass
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--per-class", type=int, default=8)
    parser.add_argument(
        "--years", type=int, nargs="+", default=list(range(2016, 2026))
    )
    parser.add_argument(
        "--no-bbref", action="store_true", help="Skip the advanced-stats scrape."
    )
    args = parser.parse_args()

    config.require_supabase()

    print("[playerindex] fetching undrafted pool…")
    pool = fetch_undrafted_index()
    print(f"[playerindex] {len(pool)} undrafted entries 2016–2025")

    for year in args.years:
        cands = [p for p in pool if p["class_year"] == year]
        # Shortlist by longevity then current scoring before the slow career
        # pulls; 20 is comfortably more than the slots we fill.
        cands.sort(key=lambda p: (p["span"], p["recent_ppg"]), reverse=True)
        shortlist = cands[:20]
        print(f"\n=== {year} UDFA class — {len(cands)} candidates, "
              f"pulling career lines for {len(shortlist)} ===")

        lines = []
        for c in shortlist:
            line = career_line(c["person_id"])
            time.sleep(0.7)
            if line:
                lines.append((c, line))

        floor = GP_FLOOR.get(year, DEFAULT_GP_FLOOR)
        qualified = [(c, l) for c, l in lines if l["gp"] >= floor]
        qualified.sort(key=lambda cl: cl[1]["total_pts"], reverse=True)
        picks = qualified[: args.per_class]
        if not picks:
            print("  none qualified")
            continue

        player_rows = []
        for i, (c, line) in enumerate(picks):
            print(f"  +{i + 1} {c['name']:<26} GP {line['gp']:>4}  "
                  f"{line['ppg']:>5} ppg")
            player_rows.append(
                {
                    "nba_person_id": c["person_id"],
                    "bbref_slug": None,
                    "name": c["name"],
                    "draft_year": year,
                    "overall_pick": UDFA_PICK + 1 + i,
                    "round_number": None,
                    "team": None,
                    "college": c["college"],
                    "headshot_url": config.NBA_HEADSHOT_URL.format(
                        person_id=c["person_id"]
                    ),
                }
            )
        stored = sb.upsert(
            "players", player_rows, on_conflict="draft_year,overall_pick"
        )
        id_by_pick = {p["overall_pick"]: p["id"] for p in stored}

        stat_rows = []
        for i, (c, line) in enumerate(picks):
            rec = {k: v for k, v in line.items() if k != "total_pts"}
            rec["player_id"] = id_by_pick[UDFA_PICK + 1 + i]
            if not args.no_bbref:
                rec.update(bbref_advanced(c["name"]))
            stat_rows.append(rec)

        # PostgREST bulk upserts need identical keys on every row.
        all_keys = {k for rec in stat_rows for k in rec}
        for rec in stat_rows:
            for k in all_keys:
                rec.setdefault(k, None)
        sb.upsert("career_stats", stat_rows, on_conflict="player_id")
        print(f"  [supabase] upserted {len(stat_rows)} UDFA career lines")

    print("\nDone. Run download_headshots.py to mirror the new headshots.")


if __name__ == "__main__":
    main()
