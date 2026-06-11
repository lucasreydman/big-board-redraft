import "server-only";
import { aggAdmin } from "./admin";
import { PIPELINE } from "./constants";
import { extractArticleText } from "./extract";
import { draftPost } from "./anthropic";

export interface DraftStageResult {
  drafted: number;
  rejectedNoSource: number;
}

export async function runDraft(): Promise<DraftStageResult> {
  const db = aggAdmin();
  const result: DraftStageResult = { drafted: 0, rejectedNoSource: 0 };

  const { data: items } = await db
    .from("agg_items")
    .select("id, title, url, summary, source_id")
    .eq("status", "scored")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(PIPELINE.draftBatchSize);
  if (!items || items.length === 0) return result;

  const sourceIds = [...new Set(items.map((i) => i.source_id).filter(Boolean))];
  const { data: sources } = await db
    .from("agg_sources")
    .select("id, name")
    .in("id", sourceIds as string[]);
  const nameMap = new Map((sources ?? []).map((s) => [s.id, s.name]));

  for (const it of items) {
    const sourceName = it.source_id
      ? (nameMap.get(it.source_id) ?? "Source")
      : "Source";

    // Prefer extracted article text; fall back to the RSS summary.
    let sourceText = await extractArticleText(it.url);
    if (sourceText.length < 200 && it.summary) sourceText = it.summary;

    // Can't verify against nothing → reject up front.
    if (!sourceText || sourceText.trim().length < 60) {
      await db
        .from("agg_items")
        .update({
          status: "rejected_verify",
          verify_reason: "no source text available to ground or verify a draft",
        })
        .eq("id", it.id);
      result.rejectedNoSource++;
      continue;
    }

    const draft = await draftPost({
      title: it.title,
      sourceName,
      url: it.url,
      sourceText,
    });

    await db
      .from("agg_items")
      .update({
        status: "drafted",
        draft_text: draft,
        source_text: sourceText,
      })
      .eq("id", it.id);
    result.drafted++;
  }

  return result;
}
