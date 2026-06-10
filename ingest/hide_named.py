"""Hide a pasted list of players (by name) from one draft class.

Companion to trim_classes.py for manual cut lines: you trim a board in the UI,
paste the cut names into a text file (one per line, blanks and duplicates
ignored), and this flips their `hidden` flag. Matching is accent- and
punctuation-insensitive so "Ante Zizic" finds "Ante Žižić".

Usage:
  python ingest/hide_named.py --year 2016 --names cuts_2016.txt          # dry run
  python ingest/hide_named.py --year 2016 --names cuts_2016.txt --apply
"""

from __future__ import annotations

import argparse
import unicodedata
from pathlib import Path

import requests

import config
import supabase_client as sb


def norm(name: str) -> str:
    s = unicodedata.normalize("NFD", name)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("’", "'").casefold()
    s = "".join(c for c in s if c.isalnum() or c.isspace())
    return " ".join(s.split())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--names", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    config.require_supabase()

    wanted = []
    for line in args.names.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and norm(line) not in {norm(w) for w in wanted}:
            wanted.append(line)

    rows = sb.select(
        "players",
        {
            "select": "id,name,overall_pick,hidden",
            "draft_year": f"eq.{args.year}",
            "order": "overall_pick",
        },
    )
    by_norm = {norm(r["name"]): r for r in rows}

    matched, missing = [], []
    for w in wanted:
        r = by_norm.get(norm(w))
        (matched if r else missing).append(r or w)

    print(f"{args.year}: {len(wanted)} names pasted, {len(matched)} matched")
    for r in matched:
        flag = " (already hidden)" if r["hidden"] else ""
        print(f"  hide  #{r['overall_pick']:>3}  {r['name']}{flag}")
    if missing:
        print("\nNOT FOUND in this class:")
        for w in missing:
            print(f"  ?     {w}")
        raise SystemExit("aborting — fix the names or the year")

    visible_after = sum(1 for r in rows if not r["hidden"]) - sum(
        1 for r in matched if not r["hidden"]
    )
    print(f"\nvisible after: {visible_after}")

    if not args.apply:
        print("dry run — re-run with --apply to hide them")
        return

    headers = {
        "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    ids = ",".join(r["id"] for r in matched)
    resp = requests.patch(
        f"{config.SUPABASE_URL}/rest/v1/players?id=in.({ids})",
        json={"hidden": True},
        headers=headers,
        timeout=60,
    )
    resp.raise_for_status()
    print(f"hid {len(matched)} players from {args.year}")


if __name__ == "__main__":
    main()
