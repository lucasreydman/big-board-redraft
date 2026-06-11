import "server-only";
import { aggAdmin } from "./admin";
import { PIPELINE } from "./constants";
import { verifyDraft } from "./anthropic";
import { similarity } from "./dedupe";

export interface VerifyStageResult {
  queued: number;
  rejected: number;
  dedupedAgainstPosted: number;
}

export async function runVerify(): Promise<VerifyStageResult> {
  const db = aggAdmin();
  const result: VerifyStageResult = {
    queued: 0,
    rejected: 0,
    dedupedAgainstPosted: 0,
  };

  const { data: items } = await db
    .from("agg_items")
    .select("id, draft_text, source_text")
    .eq("status", "drafted")
    .order("score", { ascending: false });
  if (!items || items.length === 0) return result;

  // Recently-posted drafts for the publish-time dedupe.
  const since = new Date(
    Date.now() - PIPELINE.postedDedupeWindowHours * 3600_000,
  ).toISOString();
  const { data: posted } = await db
    .from("agg_items")
    .select("draft_text")
    .eq("status", "posted")
    .gte("posted_at", since);
  const postedDrafts = (posted ?? [])
    .map((p) => p.draft_text)
    .filter((d): d is string => Boolean(d));

  for (const it of items) {
    if (!it.draft_text || !it.source_text) continue;

    // Same-story dedupe against the recently posted set.
    const dup = postedDrafts.some(
      (d) => similarity(d, it.draft_text as string) > PIPELINE.postedDedupeSimilarity,
    );
    if (dup) {
      await db
        .from("agg_items")
        .update({
          status: "rejected_verify",
          verify_reason: "duplicate of a recently posted story",
        })
        .eq("id", it.id);
      result.dedupedAgainstPosted++;
      result.rejected++;
      continue;
    }

    const verdict = await verifyDraft({
      draft: it.draft_text,
      sourceText: it.source_text,
    });

    if (verdict.pass) {
      await db
        .from("agg_items")
        .update({ status: "queued", verify_reason: verdict.reason })
        .eq("id", it.id);
      // Newly queued draft counts toward this run's posted-dedupe set.
      postedDrafts.push(it.draft_text);
      result.queued++;
    } else {
      await db
        .from("agg_items")
        .update({ status: "rejected_verify", verify_reason: verdict.reason })
        .eq("id", it.id);
      result.rejected++;
    }
  }

  return result;
}
