import "server-only";
import { aggAdmin } from "./admin";
import { PIPELINE } from "./constants";
import { scoreItems, type ScoreInput } from "./anthropic";
import type { EffectiveSettings } from "./config";

export interface ScoreStageResult {
  scored: number;
  passed: number;
  rejected: number;
}

export async function runScore(
  settings: EffectiveSettings,
): Promise<ScoreStageResult> {
  const db = aggAdmin();
  const result: ScoreStageResult = { scored: 0, passed: 0, rejected: 0 };

  const { data: items } = await db
    .from("agg_items")
    .select("id, title, summary, published_at, source_id")
    .eq("status", "new")
    .order("created_at", { ascending: true })
    .limit(PIPELINE.scoreBatchSize);
  if (!items || items.length === 0) return result;

  // Source weight + name lookup for the items in this batch.
  const sourceIds = [...new Set(items.map((i) => i.source_id).filter(Boolean))];
  const { data: sources } = await db
    .from("agg_sources")
    .select("id, name, weight")
    .in("id", sourceIds as string[]);
  const sourceMap = new Map(
    (sources ?? []).map((s) => [s.id, { name: s.name, weight: s.weight }]),
  );

  const inputs: ScoreInput[] = items.map((it) => ({
    id: it.id,
    title: it.title,
    summary: it.summary,
    published_at: it.published_at,
    source: it.source_id
      ? (sourceMap.get(it.source_id)?.name ?? "Unknown")
      : "Unknown",
  }));

  const scores = await scoreItems(inputs);
  const scoreMap = new Map(scores.map((s) => [s.id, s]));

  for (const it of items) {
    const raw = scoreMap.get(it.id);
    if (!raw) continue; // Claude omitted it; leave 'new' for the next run.

    const weight = it.source_id
      ? (sourceMap.get(it.source_id)?.weight ?? 1)
      : 1;
    const weighted = Math.min(10, raw.score * weight);
    result.scored++;

    if (weighted >= settings.scoreThreshold) {
      await db
        .from("agg_items")
        .update({ status: "scored", score: weighted, score_reason: raw.reason })
        .eq("id", it.id);
      result.passed++;
    } else {
      await db
        .from("agg_items")
        .update({
          status: "rejected_score",
          score: weighted,
          score_reason: raw.reason,
        })
        .eq("id", it.id);
      result.rejected++;
    }
  }

  return result;
}
