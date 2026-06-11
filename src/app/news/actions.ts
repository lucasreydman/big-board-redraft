"use server";

import { revalidatePath } from "next/cache";
import { aggAdmin } from "@/lib/agg/admin";
import { setConfig } from "@/lib/agg/config";
import { isOwner } from "@/lib/agg/owner";
import { runPipeline } from "@/lib/agg/pipeline";
import { SURGE } from "@/lib/agg/constants";
import type { AggSourceType } from "@/lib/agg/types";

async function requireOwner() {
  if (!(await isOwner())) throw new Error("Not authorized");
}

export async function setPaused(paused: boolean) {
  await requireOwner();
  await setConfig("paused", paused);
  revalidatePath("/news");
}

export async function setSurge(on: boolean) {
  await requireOwner();
  await setConfig("surge", {
    on,
    expires_at: on
      ? new Date(Date.now() + SURGE.durationHours * 3600_000).toISOString()
      : null,
  });
  revalidatePath("/news");
}

export async function setThreshold(value: number) {
  await requireOwner();
  const v = Math.max(1, Math.min(10, value));
  await setConfig("score_threshold", v);
  revalidatePath("/news");
}

export async function setPacing(minGapMinutes: number, maxPerHour: number) {
  await requireOwner();
  await setConfig("min_gap_minutes", Math.max(0, Math.round(minGapMinutes)));
  await setConfig("max_per_hour", Math.max(1, Math.round(maxPerHour)));
  revalidatePath("/news");
}

export async function setQuotaCap(cap: number) {
  await requireOwner();
  await setConfig("quota_cap", Math.max(0, Math.min(500, Math.round(cap))));
  revalidatePath("/news");
}

const SOURCE_TYPES: AggSourceType[] = [
  "rss",
  "reddit",
  "youtube",
  "google_news",
];

export async function addSource(formData: FormData) {
  await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as AggSourceType;
  const url = String(formData.get("url") ?? "").trim();
  const weight = Number(formData.get("weight") ?? 1) || 1;

  if (!name || !url || !SOURCE_TYPES.includes(type)) {
    throw new Error("name, valid type, and url are required");
  }
  const { error } = await aggAdmin()
    .from("agg_sources")
    .insert({ name, type, url, weight });
  if (error) throw new Error(error.message);
  revalidatePath("/news");
}

export async function toggleSource(id: string, isActive: boolean) {
  await requireOwner();
  await aggAdmin()
    .from("agg_sources")
    .update({ is_active: isActive, failure_count: isActive ? 0 : undefined })
    .eq("id", id);
  revalidatePath("/news");
}

export async function removeSource(id: string) {
  await requireOwner();
  await aggAdmin().from("agg_sources").delete().eq("id", id);
  revalidatePath("/news");
}

export async function dropQueuedItem(id: string) {
  await requireOwner();
  await aggAdmin()
    .from("agg_items")
    .update({ status: "expired" })
    .eq("id", id)
    .eq("status", "queued");
  revalidatePath("/news");
}

export async function runNow() {
  await requireOwner();
  const result = await runPipeline();
  revalidatePath("/news");
  return result;
}
