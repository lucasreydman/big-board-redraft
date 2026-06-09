"""Build prospects_2026.csv from the Tankathon big board + ESPN college stats.

Tankathon (cached HTML) supplies the board itself: rank, name, school,
position, height/weight, age, class year. ESPN supplies each player's college
career stats (GP-weighted across seasons, shooting splits from makes/attempts)
and the espn_id used for headshots. International / non-NCAA prospects keep
their Tankathon bio with blank splits — the UI shows a silhouette + empty
stat cells for them.

Usage:
  python ingest/build_prospects_2026.py            # top 60, rewrite the CSV
  python ingest/build_prospects_2026.py --limit 60 --force-fetch
"""

from __future__ import annotations

import argparse
import csv
import re
import time

import requests
from bs4 import BeautifulSoup

import config

TANKATHON_URL = "https://www.tankathon.com/big_board"
TANKATHON_CACHE = config.CACHE_DIR / "tankathon_big_board.html"
ESPN_SEARCH = "https://site.web.api.espn.com/apis/search/v2"
ESPN_STATS = (
    "https://site.web.api.espn.com/apis/common/v3/sports/basketball/"
    "mens-college-basketball/athletes/{espn_id}/stats"
)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

CLASS_YEAR = {
    "Freshman": "Fr",
    "Sophomore": "So",
    "Junior": "Jr",
    "Senior": "Sr",
    "Graduate": "Gr",
}


def fetch_tankathon(force: bool = False) -> str:
    if TANKATHON_CACHE.exists() and not force:
        return TANKATHON_CACHE.read_text(encoding="utf-8")
    resp = requests.get(TANKATHON_URL, headers=UA, timeout=30)
    resp.raise_for_status()
    TANKATHON_CACHE.parent.mkdir(parents=True, exist_ok=True)
    TANKATHON_CACHE.write_text(resp.text, encoding="utf-8")
    return resp.text


def _height(text: str) -> str | None:
    """6'9.75" -> 6-10 (nearest inch, rolling 12 into the next foot)."""
    m = re.match(r"(\d+)'([\d.]+)", text)
    if not m:
        return None
    feet, inches = int(m.group(1)), round(float(m.group(2)))
    if inches == 12:
        feet, inches = feet + 1, 0
    return f"{feet}-{inches}"


def parse_tankathon(html: str, limit: int) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for row in soup.select("div.mock-row"):
        rank_el = row.select_one(".mock-row-pick-number")
        name_el = row.select_one(".mock-row-name")
        school_pos_el = row.select_one(".mock-row-school-position")
        if not (rank_el and name_el and school_pos_el):
            continue
        rank = int(rank_el.get_text(strip=True))
        name = name_el.get_text(strip=True)
        # "SF | BYU" — school side can also be an international club.
        parts = [p.strip() for p in school_pos_el.get_text(" ", strip=True).split("|")]
        school = parts[1] if len(parts) > 1 else ""

        height = weight = age = None
        hw = row.select_one(".height-weight")
        if hw:
            divs = hw.find_all("div")
            if len(divs) >= 1:
                height = _height(divs[0].get_text(strip=True))
            if len(divs) >= 2:
                wm = re.match(r"(\d+)", divs[1].get_text(strip=True))
                weight = int(wm.group(1)) if wm else None
        ya = row.select_one(".year-age")
        if ya:
            am = re.search(r"([\d.]+)\s*yrs", ya.get_text(" ", strip=True))
            age = float(am.group(1)) if am else None

        is_college = row.select_one('.mock-row-logo a[href^="/colleges/"]') is not None
        year_raw = row.get("data-year", "")
        rows.append(
            {
                "rank": rank,
                "name": name,
                "school": school,
                "position": row.get("data-pos", "") or (parts[0] if parts else ""),
                "class_year": CLASS_YEAR.get(year_raw, year_raw or ("Intl" if not is_college else "")),
                "height": height,
                "weight": weight,
                "age": age,
                "is_college": is_college,
            }
        )
        if len(rows) >= limit:
            break
    return rows


def espn_find_id(name: str) -> str | None:
    """Search ESPN for an NCAAM player id (league 41 in the uid)."""
    try:
        resp = requests.get(
            ESPN_SEARCH,
            params={"region": "us", "lang": "en", "limit": 10, "query": name},
            headers=UA,
            timeout=20,
        )
        resp.raise_for_status()
        for section in resp.json().get("results", []):
            if section.get("type") != "player":
                continue
            for item in section.get("contents", []):
                uid = item.get("uid", "")
                if "l:41~" in uid or uid.endswith("l:41") or "NCAAM" in (
                    item.get("description") or ""
                ):
                    m = re.search(r"a:(\d+)", uid)
                    if m:
                        return m.group(1)
    except Exception as exc:  # noqa: BLE001 — best effort per player
        print(f"    espn search failed for {name}: {exc}")
    return None


def _made_att(s: str) -> tuple[float, float]:
    try:
        made, att = s.split("-")
        return float(made), float(att)
    except (ValueError, AttributeError):
        return 0.0, 0.0


def espn_career_stats(espn_id: str) -> dict:
    """GP-weighted college career averages + shooting splits from makes/attempts."""
    try:
        resp = requests.get(ESPN_STATS.format(espn_id=espn_id), headers=UA, timeout=20)
        resp.raise_for_status()
        avg = next(
            (c for c in resp.json().get("categories", []) if c.get("name") == "averages"),
            None,
        )
        if not avg:
            return {}
        labels = avg.get("labels", [])
        idx = {label: i for i, label in enumerate(labels)}
        gp_total = 0.0
        sums = {"PTS": 0.0, "REB": 0.0, "AST": 0.0}
        made = {"FG": 0.0, "3PT": 0.0, "FT": 0.0}
        att = {"FG": 0.0, "3PT": 0.0, "FT": 0.0}
        for season in avg.get("statistics", []):
            stats = season.get("stats", [])

            def col(label: str) -> str:
                i = idx.get(label)
                return stats[i] if i is not None and i < len(stats) else ""

            try:
                gp = float(col("GP") or 0)
            except ValueError:
                continue
            if not gp:
                continue
            gp_total += gp
            for key in sums:
                try:
                    sums[key] += gp * float(col(key) or 0)
                except ValueError:
                    pass
            for key in made:
                m, a = _made_att(col(key))
                made[key] += gp * m
                att[key] += gp * a
        if not gp_total:
            return {}
        out = {
            "ppg": round(sums["PTS"] / gp_total, 1),
            "rpg": round(sums["REB"] / gp_total, 1),
            "apg": round(sums["AST"] / gp_total, 1),
        }
        for key, col_name in (("fg_pct", "FG"), ("fg3_pct", "3PT"), ("ft_pct", "FT")):
            if att[col_name] > 0:
                out[key] = round(100 * made[col_name] / att[col_name], 1)
        return out
    except Exception as exc:  # noqa: BLE001
        print(f"    espn stats failed for id {espn_id}: {exc}")
        return {}


def headshot_exists(espn_id: str) -> bool:
    try:
        resp = requests.get(
            config.ESPN_HEADSHOT_URL.format(espn_id=espn_id), headers=UA, timeout=20
        )
        return resp.status_code == 200 and len(resp.content) > 1000
    except Exception:  # noqa: BLE001
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=60)
    parser.add_argument("--force-fetch", action="store_true")
    args = parser.parse_args()

    html = fetch_tankathon(force=args.force_fetch)
    board = parse_tankathon(html, args.limit)
    print(f"[tankathon] parsed {len(board)} prospects")

    out_rows = []
    for p in board:
        espn_id = stats = None
        headshot_url = ""
        if p["is_college"]:
            espn_id = espn_find_id(p["name"])
            time.sleep(0.5)
            if espn_id:
                stats = espn_career_stats(espn_id)
                time.sleep(0.5)
                if headshot_exists(espn_id):
                    headshot_url = config.ESPN_HEADSHOT_URL.format(espn_id=espn_id)
        stats = stats or {}
        status = "ok" if stats else ("intl" if not p["is_college"] else "NO STATS")
        print(f"  #{p['rank']:>2} {p['name']:<28} {p['school']:<18} {status}")
        out_rows.append(
            {
                "name": p["name"],
                "school": p["school"],
                "class_year": p["class_year"],
                "position": p["position"],
                "height": p["height"] or "",
                "weight": p["weight"] or "",
                "age": p["age"] or "",
                "ppg": stats.get("ppg", ""),
                "rpg": stats.get("rpg", ""),
                "apg": stats.get("apg", ""),
                "fg_pct": stats.get("fg_pct", ""),
                "fg3_pct": stats.get("fg3_pct", ""),
                "ft_pct": stats.get("ft_pct", ""),
                "espn_id": espn_id or "",
                "headshot_url": headshot_url,
                "projected_range": f"#{p['rank']}",
                "notes": "" if p["is_college"] else "International",
            }
        )

    with config.PROSPECTS_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
        writer.writeheader()
        writer.writerows(out_rows)
    print(f"\nWrote {len(out_rows)} rows to {config.PROSPECTS_CSV}")
    print("Run ingest_prospects.py to upsert, download_headshots.py --prospects to mirror.")


if __name__ == "__main__":
    main()
