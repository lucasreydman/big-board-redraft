"""Basketball Reference draft-page scraper.

BBRef rate limits hard and will 429 quickly, so: one request per year, a real
User-Agent, a sleep between requests, and on-disk HTML caching so re-runs never
re-hit them. Respects robots.txt (the /draft/ pages are allowed).
"""

from __future__ import annotations

import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

import config

DRAFT_URL = "https://www.basketball-reference.com/draft/NBA_{year}.html"


def _to_float(text: str | None) -> float | None:
    if text is None:
        return None
    text = text.strip()
    if text == "":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _to_int(text: str | None) -> int | None:
    f = _to_float(text)
    return int(f) if f is not None else None


def _pct(text: str | None) -> float | None:
    # BBRef stores shooting as .xxx already (a 0–1 ratio).
    return _to_float(text)


def fetch_html(year: int, *, force: bool = False) -> str:
    """Return the raw draft-page HTML, from cache when available."""
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file: Path = config.CACHE_DIR / f"draft_{year}.html"
    if cache_file.exists() and not force:
        return cache_file.read_text(encoding="utf-8")

    print(f"  [bbref] fetching {year} (sleeping {config.BBREF_SLEEP_SECONDS}s first)")
    time.sleep(config.BBREF_SLEEP_SECONDS)
    resp = requests.get(
        DRAFT_URL.format(year=year),
        headers={"User-Agent": config.BBREF_USER_AGENT},
        timeout=30,
    )
    if resp.status_code == 429:
        raise RuntimeError(
            "Basketball Reference returned 429 (rate limited). "
            "Increase BBREF_SLEEP_SECONDS and try again later."
        )
    resp.raise_for_status()
    cache_file.write_text(resp.text, encoding="utf-8")
    return resp.text


def parse_draft(html: str) -> dict[int, dict]:
    """Parse the career-stats draft table into {overall_pick: stats dict}."""
    soup = BeautifulSoup(html, "lxml")
    table = soup.find("table", id="stats")
    out: dict[int, dict] = {}
    if table is None:
        return out

    body = table.find("tbody")
    for tr in body.find_all("tr"):
        # Skip the repeated mid-table header rows.
        if tr.get("class") and "thead" in tr.get("class"):
            continue
        cells: dict[str, str] = {}
        for cell in tr.find_all(["th", "td"]):
            stat = cell.get("data-stat")
            if stat:
                cells[stat] = cell.get_text(strip=True)

        pick = _to_int(cells.get("pick_overall"))
        if pick is None:
            continue

        # bbref player slug from the player link, if present.
        slug = None
        player_cell = tr.find(attrs={"data-stat": "player"})
        if player_cell:
            link = player_cell.find("a")
            if link and link.get("href"):
                # /players/d/duranke01.html -> duranke01
                slug = link["href"].rsplit("/", 1)[-1].replace(".html", "")

        out[pick] = {
            "name": cells.get("player"),
            # BBRef credits the team that ACQUIRED the player on draft night
            # (DAL for Dončić), unlike nba_api which has the team on the clock.
            "team_abbr": cells.get("team_id") or None,
            "bbref_slug": slug,
            "college": cells.get("college_name") or None,
            "seasons": _to_int(cells.get("seasons")),
            "gp": _to_int(cells.get("g")),
            "mpg": _to_float(cells.get("mp_per_g")),
            "ppg": _to_float(cells.get("pts_per_g")),
            "rpg": _to_float(cells.get("trb_per_g")),
            "apg": _to_float(cells.get("ast_per_g")),
            "fg_pct": _pct(cells.get("fg_pct")),
            "fg3_pct": _pct(cells.get("fg3_pct")),
            "ft_pct": _pct(cells.get("ft_pct")),
            "ws": _to_float(cells.get("ws")),
            "ws48": _to_float(cells.get("ws_per_48")),
            "bpm": _to_float(cells.get("bpm")),
            "vorp": _to_float(cells.get("vorp")),
        }
    return out
