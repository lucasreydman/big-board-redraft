"""Ingest completed draft classes (2016–2025).

Joins two sources on (draft_year, overall_pick):
  * nba_api DraftHistory — canonical pick order + NBA person ids (for headshots)
  * Basketball Reference draft page — career counting + advanced metrics

Upserts into `players` and `career_stats`. Picks with tiny or zero NBA careers
are kept with null stats rather than dropped.

Usage:
  python ingest/ingest_historical.py                 # all years 2016–2025
  python ingest/ingest_historical.py --years 2016 2019
  python ingest/ingest_historical.py --fill-nba      # also pull SPG/BPG/TS%
                                                       # from nba_api (slow)
"""

from __future__ import annotations

import argparse
import math
import re
import sys
import time

import config
import bbref
import supabase_client as sb


def _norm(name: str | None) -> str:
    if not name:
        return ""
    name = name.lower()
    name = re.sub(r"[.\-']", "", name)
    name = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", name)
    return re.sub(r"\s+", " ", name).strip()


def fetch_draft_history(year: int):
    from nba_api.stats.endpoints import drafthistory

    df = drafthistory.DraftHistory(
        season_year_nullable=str(year)
    ).get_data_frames()[0]
    # Real draft picks only (round number present, organization a team/college).
    df = df[df["OVERALL_PICK"].notna()]
    return df


def fill_nba_stats(person_id: int) -> dict:
    """Best-effort SPG/BPG/TS% from nba_api career totals."""
    import json

    from nba_api.stats.endpoints import playercareerstats

    try:
        # Parse the JSON ourselves: get_data_frames() chokes on the newer
        # SeasonHighs/CareerHighs result sets (KeyError: 'resultSet'), and raw
        # JSON gives plain Python numbers instead of numpy scalars anyway.
        raw = json.loads(
            playercareerstats.PlayerCareerStats(player_id=person_id).get_json()
        )
        rs = next(
            (
                s
                for s in raw.get("resultSets", [])
                if s.get("name") == "CareerTotalsRegularSeason"
            ),
            None,
        )
        if not rs or not rs.get("rowSet"):
            return {}
        r = dict(zip(rs["headers"], rs["rowSet"][0]))
        gp = float(r.get("GP") or 0)
        out: dict = {}
        if gp and math.isfinite(gp):
            spg = float(r.get("STL") or 0) / gp
            bpg = float(r.get("BLK") or 0) / gp
            if math.isfinite(spg):
                out["spg"] = round(spg, 2)
            if math.isfinite(bpg):
                out["bpg"] = round(bpg, 2)
        fga = float(r.get("FGA") or 0)
        fta = float(r.get("FTA") or 0)
        pts = float(r.get("PTS") or 0)
        denom = 2 * (fga + 0.44 * fta)
        if denom > 0 and math.isfinite(denom):
            ts = pts / denom
            if math.isfinite(ts):
                out["ts_pct"] = round(ts, 3)
        return out
    except Exception as exc:  # noqa: BLE001 — best effort only
        print(f"    [nba_api] career stats failed for {person_id}: {exc}")
        return {}


def ingest_year(year: int, *, fill_nba: bool, force_bbref: bool) -> None:
    print(f"\n=== {year} draft class ===")

    nba_df = fetch_draft_history(year)
    print(f"  [nba_api] {len(nba_df)} picks")

    bbref_html = bbref.fetch_html(year, force=force_bbref)
    bbref_by_pick = bbref.parse_draft(bbref_html)
    bbref_by_name = {_norm(v["name"]): v for v in bbref_by_pick.values()}
    print(f"  [bbref] {len(bbref_by_pick)} rows parsed")

    player_rows: list[dict] = []
    # Stash the matched bbref stats keyed by (year, pick) for the second pass.
    stats_by_pick: dict[int, dict] = {}

    for _, row in nba_df.iterrows():
        pick = int(row["OVERALL_PICK"])
        name = str(row["PLAYER_NAME"]).strip()
        person_id = int(row["PERSON_ID"]) if row.get("PERSON_ID") else None

        # Join on pick, fall back to a normalized name match.
        bb = bbref_by_pick.get(pick) or bbref_by_name.get(_norm(name))

        team_city = str(row.get("TEAM_CITY") or "").strip()
        team_name = str(row.get("TEAM_NAME") or "").strip()
        team = " ".join(t for t in (team_city, team_name) if t) or None
        college = (bb and bb.get("college")) or (
            str(row.get("ORGANIZATION") or "").strip() or None
        )

        player_rows.append(
            {
                "nba_person_id": person_id,
                "bbref_slug": bb.get("bbref_slug") if bb else None,
                "name": name,
                "draft_year": year,
                "overall_pick": pick,
                "round_number": _safe_int(row.get("ROUND_NUMBER")),
                "team": team,
                "college": college,
                "headshot_url": (
                    config.NBA_HEADSHOT_URL.format(person_id=person_id)
                    if person_id
                    else None
                ),
            }
        )
        if bb:
            stats_by_pick[pick] = bb

    stored = sb.upsert(
        "players", player_rows, on_conflict="draft_year,overall_pick"
    )
    print(f"  [supabase] upserted {len(stored)} players")

    id_by_pick = {p["overall_pick"]: p["id"] for p in stored}

    stat_rows: list[dict] = []
    for pick, player_id in id_by_pick.items():
        bb = stats_by_pick.get(pick)
        rec: dict = {"player_id": player_id}
        if bb:
            for key in (
                "gp",
                "mpg",
                "ppg",
                "rpg",
                "apg",
                "fg_pct",
                "fg3_pct",
                "ft_pct",
                "ws",
                "ws48",
                "bpm",
                "vorp",
                "seasons",
            ):
                rec[key] = bb.get(key)
        stat_rows.append(rec)

    if fill_nba:
        print("  [nba_api] filling SPG/BPG/TS% (throttled)…")
        person_by_pick = {
            int(r["OVERALL_PICK"]): int(r["PERSON_ID"])
            for _, r in nba_df.iterrows()
            if r.get("PERSON_ID")
        }
        for rec in stat_rows:
            pid = next(
                (p for p, i in id_by_pick.items() if i == rec["player_id"]),
                None,
            )
            person_id = person_by_pick.get(pid)
            if person_id:
                rec.update(fill_nba_stats(person_id))
                time.sleep(0.6)

    # PostgREST bulk upserts reject mixed-shape rows (PGRST102: "All object
    # keys must match"), and the nba_api fill only adds keys where it succeeds.
    all_keys = {k for rec in stat_rows for k in rec}
    for rec in stat_rows:
        for k in all_keys:
            rec.setdefault(k, None)

    sb.upsert("career_stats", stat_rows, on_conflict="player_id")
    print(f"  [supabase] upserted {len(stat_rows)} career_stats rows")


def _safe_int(v) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--years",
        type=int,
        nargs="+",
        default=config.REDRAFT_YEARS,
        help="Specific draft years to ingest (default 2016–2025).",
    )
    parser.add_argument(
        "--fill-nba",
        action="store_true",
        help="Also pull SPG/BPG/TS% from nba_api career totals (slow).",
    )
    parser.add_argument(
        "--force-bbref",
        action="store_true",
        help="Re-fetch Basketball Reference pages even if cached.",
    )
    args = parser.parse_args()

    config.require_supabase()

    for year in args.years:
        try:
            ingest_year(
                year, fill_nba=args.fill_nba, force_bbref=args.force_bbref
            )
        except Exception as exc:  # noqa: BLE001
            print(f"!! {year} failed: {exc}", file=sys.stderr)

    print("\nDone. Run download_headshots.py to mirror headshots to storage.")


if __name__ == "__main__":
    main()
