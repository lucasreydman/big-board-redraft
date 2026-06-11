import "server-only";
import { aggAdmin } from "./admin";
import { getConfig, surgeActive, type AggConfig } from "./config";
import type { AggItem, AggItemStatus, AggSource } from "./types";

export interface StatusCounts {
  new: number;
  scored: number;
  drafted: number;
  queued: number;
  posted: number;
  rejected_score: number;
  rejected_verify: number;
  failed: number;
  expired: number;
}

const ALL_STATUSES: AggItemStatus[] = [
  "new",
  "scored",
  "drafted",
  "queued",
  "posted",
  "rejected_score",
  "rejected_verify",
  "failed",
  "expired",
];

export interface NewsDashboard {
  config: AggConfig;
  surgeActive: boolean;
  quota: { month: string; postsUsed: number; cap: number };
  counts: StatusCounts;
  postedToday: number;
  sources: AggSource[];
  queued: AggItem[];
  recentPosts: AggItem[];
  recentRejects: AggItem[];
}

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getDashboard(): Promise<NewsDashboard> {
  const db = aggAdmin();
  const config = await getConfig();

  // Status counts (one head/count query per status, run in parallel).
  const countResults = await Promise.all(
    ALL_STATUSES.map((s) =>
      db
        .from("agg_items")
        .select("*", { count: "exact", head: true })
        .eq("status", s),
    ),
  );
  const counts = {} as StatusCounts;
  ALL_STATUSES.forEach((s, i) => {
    counts[s] = countResults[i].count ?? 0;
  });

  const month = monthKey();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [
    quotaRow,
    postedTodayRes,
    sourcesRes,
    queuedRes,
    postsRes,
    rejectsRes,
    surge,
  ] = await Promise.all([
    db.from("agg_quota").select("*").eq("month", month).maybeSingle(),
    db
      .from("agg_items")
      .select("*", { count: "exact", head: true })
      .eq("status", "posted")
      .gte("posted_at", todayStart.toISOString()),
    db.from("agg_sources").select("*").order("created_at", { ascending: true }),
    db
      .from("agg_items")
      .select("*")
      .eq("status", "queued")
      .order("score", { ascending: false })
      .limit(20),
    db
      .from("agg_items")
      .select("*")
      .eq("status", "posted")
      .order("posted_at", { ascending: false })
      .limit(20),
    db
      .from("agg_items")
      .select("*")
      .in("status", ["rejected_verify", "failed"])
      .order("created_at", { ascending: false })
      .limit(20),
    surgeActive(config),
  ]);

  return {
    config,
    surgeActive: surge,
    quota: {
      month,
      postsUsed: quotaRow.data?.posts_used ?? 0,
      cap: quotaRow.data?.cap ?? config.quota_cap,
    },
    counts,
    postedToday: postedTodayRes.count ?? 0,
    sources: (sourcesRes.data ?? []) as AggSource[],
    queued: (queuedRes.data ?? []) as AggItem[],
    recentPosts: (postsRes.data ?? []) as AggItem[],
    recentRejects: (rejectsRes.data ?? []) as AggItem[],
  };
}
