import "server-only";
import { aggAdmin } from "./admin";
import { SURGE } from "./constants";
import type { Json } from "@/lib/supabase/database.types";

// Owner-tunable config lives in agg_config as key/jsonb rows. These helpers
// read the whole table once, apply defaults, and resolve surge-mode overrides.

export interface SurgeState {
  on: boolean;
  expires_at: string | null;
}

export interface AggConfig {
  paused: boolean;
  score_threshold: number;
  min_gap_minutes: number;
  max_per_hour: number;
  quota_cap: number;
  surge: SurgeState;
}

const DEFAULTS: AggConfig = {
  paused: false,
  score_threshold: 7.5,
  min_gap_minutes: 45,
  max_per_hour: 2,
  quota_cap: 450,
  surge: { on: false, expires_at: null },
};

export async function getConfig(): Promise<AggConfig> {
  const { data, error } = await aggAdmin().from("agg_config").select("*");
  if (error) throw new Error(`Failed to read config: ${error.message}`);

  const cfg: AggConfig = { ...DEFAULTS };
  for (const row of data ?? []) {
    switch (row.key) {
      case "paused":
        cfg.paused = Boolean(row.value);
        break;
      case "score_threshold":
        cfg.score_threshold = Number(row.value);
        break;
      case "min_gap_minutes":
        cfg.min_gap_minutes = Number(row.value);
        break;
      case "max_per_hour":
        cfg.max_per_hour = Number(row.value);
        break;
      case "quota_cap":
        cfg.quota_cap = Number(row.value);
        break;
      case "surge":
        cfg.surge = row.value as SurgeState;
        break;
    }
  }
  return cfg;
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  const { error } = await aggAdmin()
    .from("agg_config")
    .upsert(
      { key, value: value as Json, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(`Failed to write config ${key}: ${error.message}`);
}

/** True if surge mode is on and not expired. Auto-clears an expired surge. */
export async function surgeActive(cfg: AggConfig): Promise<boolean> {
  if (!cfg.surge.on) return false;
  if (cfg.surge.expires_at && new Date(cfg.surge.expires_at) < new Date()) {
    await setConfig("surge", { on: false, expires_at: null });
    return false;
  }
  return true;
}

/** The thresholds/pacing actually in force this run, after surge overrides. */
export interface EffectiveSettings {
  scoreThreshold: number;
  minGapMinutes: number;
  maxPerHour: number;
  surge: boolean;
}

export async function effectiveSettings(
  cfg: AggConfig,
): Promise<EffectiveSettings> {
  const surge = await surgeActive(cfg);
  return surge
    ? {
        scoreThreshold: SURGE.scoreThreshold,
        minGapMinutes: SURGE.minGapMinutes,
        maxPerHour: SURGE.maxPerHour,
        surge: true,
      }
    : {
        scoreThreshold: cfg.score_threshold,
        minGapMinutes: cfg.min_gap_minutes,
        maxPerHour: cfg.max_per_hour,
        surge: false,
      };
}
