import "server-only";
import { aggAdmin } from "./admin";
import { PIPELINE } from "./constants";
import { getConfig, effectiveSettings } from "./config";
import { runIngest, type IngestResult } from "./ingest";
import { runScore, type ScoreStageResult } from "./score";
import { runDraft, type DraftStageResult } from "./draft";
import { runVerify, type VerifyStageResult } from "./verify";
import { runPublish, type PublishStageResult } from "./publish";

export interface PipelineResult {
  startedAt: string;
  durationMs: number;
  surge: boolean;
  paused: boolean;
  ingest: IngestResult;
  score: ScoreStageResult;
  draft: DraftStageResult;
  verify: VerifyStageResult;
  publish: PublishStageResult;
  maintenance: { expired: number; deleted: number };
}

async function runMaintenance(): Promise<{ expired: number; deleted: number }> {
  const db = aggAdmin();

  // Queued items go stale fast — expire anything older than the TTL.
  const queueCutoff = new Date(
    Date.now() - PIPELINE.queueTtlHours * 3600_000,
  ).toISOString();
  const { data: expired } = await db
    .from("agg_items")
    .update({ status: "expired" })
    .eq("status", "queued")
    .lt("created_at", queueCutoff)
    .select("id");

  // Delete old rejected items (tuning data has a shelf life).
  const rejectCutoff = new Date(
    Date.now() - PIPELINE.rejectedRetentionDays * 86_400_000,
  ).toISOString();
  const { data: deleted } = await db
    .from("agg_items")
    .delete()
    .in("status", ["rejected_score", "rejected_verify", "failed", "expired"])
    .lt("created_at", rejectCutoff)
    .select("id");

  return { expired: expired?.length ?? 0, deleted: deleted?.length ?? 0 };
}

// The single orchestrator run. Stages are idempotent and status-driven, so a
// timeout mid-run is safe: the next invocation picks up where it left off.
export async function runPipeline(): Promise<PipelineResult> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  const cfg = await getConfig();
  const settings = await effectiveSettings(cfg);

  const ingest = await runIngest();
  const score = await runScore(settings);
  const draft = await runDraft();
  const verify = await runVerify();
  const publish = await runPublish(cfg, settings);
  const maintenance = await runMaintenance();

  return {
    startedAt,
    durationMs: Date.now() - t0,
    surge: settings.surge,
    paused: cfg.paused,
    ingest,
    score,
    draft,
    verify,
    publish,
    maintenance,
  };
}
