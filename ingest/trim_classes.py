"""Trim each draft class to its top 30 players by a maturity-weighted score.

The keep-score blends what a player has PRODUCED with what he WAS DRAFTED to
be, trusting production more as a class ages:

    years   = 2026 - draft_year                (completed seasons available)
    m       = min(years / 4, 1)                (trust in production, 1.0 at 4+ yrs)
    gp_rate = min(gp / (74 * years), 1)        (~74 playable games per season)
    ws_rate = clamp(ws / (8 * years), 0, 1)    (8 WS/season ~ All-NBA pace)
    P       = 0.6 * gp_rate + 0.4 * ws_rate    (production)
    D       = (61 - min(pick, 61)) / 60        (pedigree; 0 for UDFA)
    score   = m * P + (1 - m) * (0.6 * D + 0.4 * P)

Young classes lean on pedigree (an injured 2025 lottery pick survives); old
classes are judged almost purely on what they actually did.

Usage:
  python ingest/trim_classes.py            # dry run, prints keep/cut lists
  python ingest/trim_classes.py --apply    # delete the cuts
  python ingest/trim_classes.py --apply --reset-redrafts
"""

from __future__ import annotations

import argparse

import requests

import config
import supabase_client as sb

CURRENT_CYCLE = 2026
KEEP = 30
UDFA_PICK = 100


def keep_score(p: dict) -> float:
    years = max(CURRENT_CYCLE - p["draft_year"], 1)
    m = min(years / 4, 1)
    gp = p["gp"] or 0
    ws = p["ws"] or 0.0
    gp_rate = min(gp / (74 * years), 1)
    ws_rate = min(max(ws / (8 * years), 0), 1)
    production = 0.6 * gp_rate + 0.4 * ws_rate
    pick = p["overall_pick"]
    pedigree = 0.0 if pick >= UDFA_PICK else (61 - min(pick, 61)) / 60
    return m * production + (1 - m) * (0.6 * pedigree + 0.4 * production)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--reset-redrafts", action="store_true")
    args = parser.parse_args()

    config.require_supabase()

    rows = sb.select(
        "players",
        {
            "select": "id,name,draft_year,overall_pick,career_stats(gp,ws)",
            "order": "draft_year,overall_pick",
        },
    )
    players = [
        {
            "id": r["id"],
            "name": r["name"],
            "draft_year": r["draft_year"],
            "overall_pick": r["overall_pick"],
            "gp": (r.get("career_stats") or {}).get("gp"),
            "ws": (r.get("career_stats") or {}).get("ws"),
        }
        for r in rows
    ]

    cut_ids: list[str] = []
    for year in sorted({p["draft_year"] for p in players}):
        cls = [p for p in players if p["draft_year"] == year]
        cls.sort(key=lambda p: (keep_score(p), p["gp"] or 0), reverse=True)
        # Forced keeps: top-10 picks are always in — a redraft needs its busts
        # so you can see where they SHOULD have gone. Plus the injury shield:
        # a first-rounder from the newest class who hasn't played yet.
        forced = [
            p
            for p in cls
            if p["overall_pick"] <= 10
            or (
                year == CURRENT_CYCLE - 1
                and p["overall_pick"] <= 30
                and not p["gp"]
            )
        ]
        rest = [p for p in cls if p not in forced]
        keep = forced + rest[: KEEP - len(forced)]
        cut = rest[KEEP - len(forced) :]
        for p in forced:
            why = "top-10 pick" if p["overall_pick"] <= 10 else "injured, no games"
            print(f"  SHIELD       #{p['overall_pick']}  {p['name']} ({why})")
        cut_ids += [p["id"] for p in cut]
        print(f"\n=== {year}: keep {len(keep)}, cut {len(cut)} ===")
        for p in keep[:5]:
            tag = "UDFA" if p["overall_pick"] >= UDFA_PICK else f"#{p['overall_pick']}"
            print(f"  keep {keep_score(p):.3f}  {tag:>5}  {p['name']}")
        print("  …")
        for p in keep[-3:]:
            tag = "UDFA" if p["overall_pick"] >= UDFA_PICK else f"#{p['overall_pick']}"
            print(f"  keep {keep_score(p):.3f}  {tag:>5}  {p['name']} (bubble)")
        for p in cut[:3]:
            tag = "UDFA" if p["overall_pick"] >= UDFA_PICK else f"#{p['overall_pick']}"
            print(f"  CUT  {keep_score(p):.3f}  {tag:>5}  {p['name']} (first out)")

    print(f"\ntotal cuts: {len(cut_ids)}")
    if not args.apply:
        print("dry run — re-run with --apply to delete")
        return

    headers = {
        "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
    }
    for i in range(0, len(cut_ids), 50):
        chunk = ",".join(cut_ids[i : i + 50])
        resp = requests.delete(
            f"{config.SUPABASE_URL}/rest/v1/players?id=in.({chunk})",
            headers=headers,
            timeout=60,
        )
        resp.raise_for_status()
    print(f"deleted {len(cut_ids)} players")

    if args.reset_redrafts:
        resp = requests.delete(
            f"{config.SUPABASE_URL}/rest/v1/redrafts?id=not.is.null",
            headers=headers,
            timeout=60,
        )
        resp.raise_for_status()
        print("all saved redrafts reset to default")


if __name__ == "__main__":
    main()
