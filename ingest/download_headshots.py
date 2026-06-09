"""Mirror headshots into the Supabase storage bucket.

By default the app hotlinks the CDN URLs (cdn.nba.com / a.espncdn.com). This
downloads each one into the `headshots` bucket and repoints the stored
headshot_url at the durable storage copy, so the app isn't dependent on a live
CDN link. 404s / missing images are skipped — the UI shows a silhouette
fallback for anything without a working URL.

Usage:
  python ingest/download_headshots.py                 # players + prospects
  python ingest/download_headshots.py --players
  python ingest/download_headshots.py --prospects
"""

from __future__ import annotations

import argparse

import requests

import config
import supabase_client as sb


def _download(url: str) -> bytes | None:
    try:
        resp = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code == 200 and resp.content:
            return resp.content
    except Exception as exc:  # noqa: BLE001
        print(f"    download failed: {exc}")
    return None


def mirror_players() -> None:
    players = sb.select(
        "players",
        {"select": "id,nba_person_id,headshot_url", "nba_person_id": "not.is.null"},
    )
    print(f"[players] {len(players)} with a person id")
    for p in players:
        person_id = p["nba_person_id"]
        src = config.NBA_HEADSHOT_URL.format(person_id=person_id)
        content = _download(src)
        if not content:
            print(f"  - {person_id}: no image (will use silhouette)")
            continue
        path = f"players/{person_id}.png"
        public_url = sb.upload_storage(config.HEADSHOT_BUCKET, path, content, "image/png")
        sb.upsert(
            "players",
            [{"id": p["id"], "headshot_url": public_url}],
            on_conflict="id",
        )
        print(f"  + {person_id} -> storage")


def mirror_prospects() -> None:
    prospects = sb.select(
        "prospects",
        {"select": "id,espn_id,headshot_url", "espn_id": "not.is.null"},
    )
    print(f"[prospects] {len(prospects)} with an espn id")
    for p in prospects:
        espn_id = p["espn_id"]
        src = config.ESPN_HEADSHOT_URL.format(espn_id=espn_id)
        content = _download(src)
        if not content:
            print(f"  - {espn_id}: no image (will use silhouette)")
            continue
        path = f"prospects/{espn_id}.png"
        public_url = sb.upload_storage(config.HEADSHOT_BUCKET, path, content, "image/png")
        sb.upsert(
            "prospects",
            [{"id": p["id"], "headshot_url": public_url}],
            on_conflict="id",
        )
        print(f"  + {espn_id} -> storage")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--players", action="store_true", help="Only players.")
    parser.add_argument("--prospects", action="store_true", help="Only prospects.")
    args = parser.parse_args()

    config.require_supabase()

    do_players = args.players or not args.prospects
    do_prospects = args.prospects or not args.players

    if do_players:
        mirror_players()
    if do_prospects:
        mirror_prospects()

    print("Done.")


if __name__ == "__main__":
    main()
