"""Set the 2026 board's default order from a ranked name list.

The big board's fresh-board order sorts by the first number in
`projected_range` ("#13", "#10-20"), so writing "#1".."#N" down a ranked list
IS the default order. Prospects not on the list are deleted. Matching is
accent- and punctuation-insensitive (shared with hide_named.py).

Usage:
  python ingest/rank_prospects.py --names data/board_2026.txt           # dry run
  python ingest/rank_prospects.py --names data/board_2026.txt --apply
"""

from __future__ import annotations

import argparse
from pathlib import Path

import requests

import config
import supabase_client as sb
from hide_named import norm


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--names", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    config.require_supabase()

    ranked = [
        line.strip()
        for line in args.names.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]

    rows = sb.select("prospects", {"select": "id,name,projected_range"})
    by_norm = {norm(r["name"]): r for r in rows}

    matched, missing = [], []
    for i, name in enumerate(ranked, start=1):
        r = by_norm.get(norm(name))
        if r:
            matched.append((i, r))
        else:
            missing.append((i, name))

    matched_ids = {r["id"] for _, r in matched}
    extras = [r for r in rows if r["id"] not in matched_ids]

    print(f"{len(ranked)} ranked names, {len(matched)} matched, "
          f"{len(extras)} extras to delete (of {len(rows)} prospects)")
    for i, r in matched:
        print(f"  #{i:>2}  {r['name']}")
    if missing:
        print("\nNOT FOUND in prospects:")
        for i, name in missing:
            print(f"  #{i:>2}  {name}")
        raise SystemExit("aborting — fix the names first")
    if extras:
        print("\nDELETE:")
        for r in sorted(extras, key=lambda r: r["name"]):
            print(f"  X    {r['name']} ({r['projected_range'] or 'no range'})")

    if not args.apply:
        print("\ndry run — re-run with --apply")
        return

    for i, r in matched:
        sb.update("prospects", r["id"], {"projected_range": f"#{i}"})
    print(f"ranked {len(matched)} prospects #1–#{len(matched)}")

    headers = {
        "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
    }
    if extras:
        ids = ",".join(r["id"] for r in extras)
        resp = requests.delete(
            f"{config.SUPABASE_URL}/rest/v1/prospects?id=in.({ids})",
            headers=headers,
            timeout=60,
        )
        resp.raise_for_status()
        print(f"deleted {len(extras)} extra prospects")


if __name__ == "__main__":
    main()
