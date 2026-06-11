import "server-only";
import Parser from "rss-parser";
import { createHash } from "node:crypto";
import { PIPELINE } from "./constants";
import type { AggSource, NormalizedItem } from "./types";

const rss = new Parser({ timeout: PIPELINE.sourceTimeoutMs });

/** Canonicalize a URL for dedupe: drop tracking params, hash, trailing slash. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    const drop = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "ref",
      "ref_src",
      "ref_url",
      "cmpid",
      "icid",
    ];
    for (const k of drop) u.searchParams.delete(k);
    u.host = u.host.toLowerCase();
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

export function urlHash(canonical: string): string {
  return createHash("sha256").update(canonical).digest("hex");
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; TMNAggregator/1.0; +https://themodernnba)",
    },
    signal: AbortSignal.timeout(PIPELINE.sourceTimeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchFeed(url: string): Promise<NormalizedItem[]> {
  const xml = await fetchText(url);
  const feed = await rss.parseString(xml);
  return (feed.items ?? [])
    .filter((it) => it.link)
    .map((it) => ({
      url: it.link as string,
      title: (it.title ?? "").trim(),
      summary:
        (it.contentSnippet ?? it.content ?? it.summary ?? "")
          .toString()
          .trim() || null,
      published_at: it.isoDate ?? it.pubDate ?? null,
    }));
}

interface RedditChild {
  data?: {
    title?: string;
    selftext?: string;
    permalink?: string;
    url?: string;
    created_utc?: number;
    stickied?: boolean;
    is_self?: boolean;
  };
}

async function fetchReddit(url: string): Promise<NormalizedItem[]> {
  const body = await fetchText(url);
  const json = JSON.parse(body) as { data?: { children?: RedditChild[] } };
  const children = json.data?.children ?? [];
  return children
    .map((c) => c.data)
    .filter((d): d is NonNullable<RedditChild["data"]> => Boolean(d?.title))
    .filter((d) => !d.stickied)
    .map((d) => ({
      // Always link to the reddit discussion (stable, attributable).
      url: d.permalink
        ? `https://www.reddit.com${d.permalink}`
        : (d.url as string),
      title: (d.title ?? "").trim(),
      summary: (d.selftext ?? "").trim().slice(0, 800) || null,
      published_at: d.created_utc
        ? new Date(d.created_utc * 1000).toISOString()
        : null,
    }));
}

/** Fetch one source, normalized. Throws on failure (caller tracks failures). */
export async function fetchSource(source: AggSource): Promise<NormalizedItem[]> {
  switch (source.type) {
    case "rss":
    case "youtube":
    case "google_news":
      return fetchFeed(source.url);
    case "reddit":
      return fetchReddit(source.url);
    default:
      return [];
  }
}
