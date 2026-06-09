"""Tiny Supabase REST helpers for the ingestion scripts.

Uses PostgREST directly (no extra SDK dependency) with the service-role key,
which bypasses RLS. Upserts resolve conflicts on the table's unique key and
return the stored rows so we can map names/picks back to generated ids.
"""

from __future__ import annotations

from typing import Any

import requests

import config


def _headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    h = {
        "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def upsert(
    table: str,
    rows: list[dict[str, Any]],
    on_conflict: str,
) -> list[dict[str, Any]]:
    """Upsert rows, merging duplicates on `on_conflict`. Returns stored rows."""
    if not rows:
        return []
    url = f"{config.SUPABASE_URL}/rest/v1/{table}?on_conflict={on_conflict}"
    resp = requests.post(
        url,
        json=rows,
        headers=_headers(
            {"Prefer": "resolution=merge-duplicates,return=representation"}
        ),
        timeout=60,
    )
    if resp.status_code >= 300:
        raise RuntimeError(
            f"Upsert into {table} failed ({resp.status_code}): {resp.text[:500]}"
        )
    return resp.json()


def update(table: str, row_id: str, patch: dict[str, Any]) -> None:
    """Update a single row by id. Partial payloads must PATCH, not upsert:
    NOT NULL checks run on the proposed insert row before ON CONFLICT."""
    url = f"{config.SUPABASE_URL}/rest/v1/{table}?id=eq.{row_id}"
    resp = requests.patch(url, json=patch, headers=_headers(), timeout=60)
    if resp.status_code >= 300:
        raise RuntimeError(
            f"Update {table} id={row_id} failed ({resp.status_code}): {resp.text[:500]}"
        )


def select(table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    url = f"{config.SUPABASE_URL}/rest/v1/{table}"
    resp = requests.get(url, headers=_headers(), params=params, timeout=60)
    resp.raise_for_status()
    return resp.json()


def upload_storage(bucket: str, path: str, content: bytes, content_type: str) -> str:
    """Upload (upsert) an object to a storage bucket. Returns its public URL."""
    url = f"{config.SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    resp = requests.post(
        url,
        data=content,
        headers=_headers(
            {"Content-Type": content_type, "x-upsert": "true"}
        ),
        timeout=60,
    )
    if resp.status_code >= 300 and resp.status_code != 409:
        raise RuntimeError(
            f"Storage upload failed ({resp.status_code}): {resp.text[:300]}"
        )
    return f"{config.SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"
