import "server-only";
import { aggAdmin } from "./admin";
import { PIPELINE } from "./constants";
import { canonicalUrl, fetchSource, urlHash } from "./sources";
import { similarity } from "./dedupe";
import type { AggSource } from "./types";

export interface IngestResult {
  fetched: number;
  inserted: number;
  duplicates: number;
  sourceFailures: number;
  perSource: Record<string, number>;
}

export async function runIngest(): Promise<IngestResult> {
  const db = aggAdmin();
  const result: IngestResult = {
    fetched: 0,
    inserted: 0,
    duplicates: 0,
    sourceFailures: 0,
    perSource: {},
  };

  const { data: sources } = await db
    .from("agg_sources")
    .select("*")
    .eq("is_active", true);
  if (!sources || sources.length === 0) return result;

  // Recent titles for fuzzy dedupe (last N hours).
  const since = new Date(
    Date.now() - PIPELINE.dedupeWindowHours * 3600_000,
  ).toISOString();
  const { data: recent } = await db
    .from("agg_items")
    .select("title")
    .gte("created_at", since)
    .limit(2000);
  const recentTitles = (recent ?? []).map((r) => r.title);

  // Fetch every source in parallel, isolating failures.
  const fetches = await Promise.allSettled(
    sources.map(async (s) => ({ source: s, items: await fetchSource(s) })),
  );

  const seenHashes = new Set<string>();
  const acceptedTitles: string[] = [...recentTitles];

  for (let i = 0; i < fetches.length; i++) {
    const source = sources[i] as AggSource;
    const outcome = fetches[i];

    if (outcome.status === "rejected") {
      result.sourceFailures++;
      await markSourceFailure(source);
      continue;
    }

    await markSourceSuccess(source);
    const items = outcome.value.items;
    result.fetched += items.length;
    let insertedForSource = 0;

    for (const item of items) {
      if (!item.title || !item.url) continue;
      const canonical = canonicalUrl(item.url);
      const hash = urlHash(canonical);

      if (seenHashes.has(hash)) {
        result.duplicates++;
        continue;
      }
      seenHashes.add(hash);

      // Exact dedupe against the DB.
      const { data: existing } = await db
        .from("agg_items")
        .select("id")
        .eq("url_hash", hash)
        .maybeSingle();
      if (existing) {
        result.duplicates++;
        continue;
      }

      // Fuzzy dedupe against recent + already-accepted titles this run.
      const dup = acceptedTitles.some(
        (t) => similarity(t, item.title) > PIPELINE.dedupeSimilarity,
      );
      if (dup) {
        result.duplicates++;
        continue;
      }

      const { error } = await db.from("agg_items").insert({
        source_id: source.id,
        url: canonical,
        url_hash: hash,
        title: item.title,
        summary: item.summary,
        published_at: item.published_at,
        status: "new",
      });
      if (!error) {
        result.inserted++;
        insertedForSource++;
        acceptedTitles.push(item.title);
      }
    }
    result.perSource[source.name] = insertedForSource;
  }

  return result;
}

async function markSourceFailure(source: AggSource): Promise<void> {
  const db = aggAdmin();
  const failure_count = source.failure_count + 1;
  await db
    .from("agg_sources")
    .update({
      failure_count,
      last_fetched_at: new Date().toISOString(),
      is_active: failure_count < PIPELINE.maxSourceFailures,
    })
    .eq("id", source.id);
}

async function markSourceSuccess(source: AggSource): Promise<void> {
  if (source.failure_count === 0) {
    await aggAdmin()
      .from("agg_sources")
      .update({ last_fetched_at: new Date().toISOString() })
      .eq("id", source.id);
    return;
  }
  await aggAdmin()
    .from("agg_sources")
    .update({ failure_count: 0, last_fetched_at: new Date().toISOString() })
    .eq("id", source.id);
}
