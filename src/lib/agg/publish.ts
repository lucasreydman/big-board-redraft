import "server-only";
import { aggAdmin } from "./admin";
import { PIPELINE } from "./constants";
import { postTweet, xConfigured } from "./x";
import type { AggConfig, EffectiveSettings } from "./config";

export interface PublishStageResult {
  status:
    | "posted"
    | "paused"
    | "empty"
    | "paced"
    | "quota_exhausted"
    | "failed"
    | "no_x_credentials";
  tweetId?: string;
  itemId?: string;
  error?: string;
}

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runPublish(
  cfg: AggConfig,
  settings: EffectiveSettings,
): Promise<PublishStageResult> {
  const db = aggAdmin();

  if (cfg.paused) return { status: "paused" };
  if (!xConfigured()) return { status: "no_x_credentials" };

  // --- Pacing -------------------------------------------------------------
  const now = Date.now();
  const hourAgo = new Date(now - 3600_000).toISOString();
  const { data: recentPosts } = await db
    .from("agg_items")
    .select("posted_at")
    .eq("status", "posted")
    .gte("posted_at", hourAgo)
    .order("posted_at", { ascending: false });

  const postsThisHour = recentPosts?.length ?? 0;
  if (postsThisHour >= settings.maxPerHour) return { status: "paced" };

  const lastPostedAt = recentPosts?.[0]?.posted_at;
  if (lastPostedAt) {
    const gapMin = (now - new Date(lastPostedAt).getTime()) / 60_000;
    if (gapMin < settings.minGapMinutes) return { status: "paced" };
  }

  // --- Pick the best queued item -----------------------------------------
  const { data: queued } = await db
    .from("agg_items")
    .select("id, draft_text")
    .eq("status", "queued")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!queued || !queued.draft_text) return { status: "empty" };

  // --- Reserve quota atomically ------------------------------------------
  const month = monthKey();
  const { data: reserved } = await db.rpc("agg_reserve_quota", {
    p_month: month,
    p_cap: cfg.quota_cap,
  });
  if (!reserved) return { status: "quota_exhausted" };

  // --- Jitter so we never post exactly on the clock mark ------------------
  // Capped well under the route's 300s budget: the earlier stages (extraction
  // + Claude calls) have already consumed part of it.
  const jitterMs = Math.floor(
    Math.random() * Math.min(PIPELINE.maxJitterMinutes * 60, 90) * 1000,
  );
  if (jitterMs > 0) await sleep(jitterMs);

  // --- Post (one retry) ---------------------------------------------------
  let res = await postTweet(queued.draft_text);
  if (!res.ok) res = await postTweet(queued.draft_text);

  if (res.ok && res.tweetId) {
    await db
      .from("agg_items")
      .update({
        status: "posted",
        tweet_id: res.tweetId,
        posted_at: new Date().toISOString(),
      })
      .eq("id", queued.id);
    return { status: "posted", tweetId: res.tweetId, itemId: queued.id };
  }

  // Failure: give the quota back, mark the item failed.
  await db.rpc("agg_release_quota", { p_month: month });
  await db
    .from("agg_items")
    .update({ status: "failed", verify_reason: res.error ?? "post failed" })
    .eq("id", queued.id);
  return { status: "failed", itemId: queued.id, error: res.error };
}
