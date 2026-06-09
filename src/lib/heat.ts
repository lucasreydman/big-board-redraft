import type { Player } from "@/lib/types";
import type { StatKey } from "@/lib/constants";

// Percentile-based stat highlighting: the top of each column glows so the
// table can be scanned without reading every number.

export type HeatLevel = "hot" | "warm" | null;

export function buildHeat(
  players: Player[],
  keys: StatKey[],
): (key: StatKey, value: number | null) => HeatLevel {
  const thresholds = new Map<StatKey, { hot: number; warm: number }>();
  for (const key of keys) {
    const values = players
      .map((p) => p.stats[key as keyof Player["stats"]] as number | null)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    if (values.length < 8) continue;
    const q = (f: number) => values[Math.floor(f * (values.length - 1))];
    thresholds.set(key, { hot: q(0.92), warm: q(0.72) });
  }
  return (key, value) => {
    if (value === null) return null;
    const t = thresholds.get(key);
    if (!t) return null;
    if (value >= t.hot) return "hot";
    if (value >= t.warm) return "warm";
    return null;
  };
}

import type { Prospect } from "@/lib/types";
import type { ProspectStatKey } from "@/lib/constants";

export function buildProspectHeat(
  prospects: Prospect[],
  keys: ProspectStatKey[],
): (key: ProspectStatKey, value: number | null) => HeatLevel {
  const thresholds = new Map<ProspectStatKey, { hot: number; warm: number }>();
  for (const key of keys) {
    if (key === "age") continue; // younger ≠ "hot stat" in the same sense
    const values = prospects
      .map((p) => p[key])
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    if (values.length < 8) continue;
    const q = (f: number) => values[Math.floor(f * (values.length - 1))];
    thresholds.set(key, { hot: q(0.92), warm: q(0.72) });
  }
  return (key, value) => {
    if (value == null) return null;
    const t = thresholds.get(key);
    if (!t) return null;
    if (value >= t.hot) return "hot";
    if (value >= t.warm) return "warm";
    return null;
  };
}

export function heatClass(level: HeatLevel): string {
  if (level === "hot") return "text-accent font-semibold";
  if (level === "warm") return "text-ink";
  return "text-ink-muted";
}
