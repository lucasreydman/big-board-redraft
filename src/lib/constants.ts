// Completed classes available for redraft mode.
export const REDRAFT_YEARS = [
  2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
] as const;

export const PROSPECT_YEAR = 2026;

export type StatKey =
  | "gp"
  | "ppg"
  | "rpg"
  | "apg"
  | "fgPct"
  | "fg3Pct"
  | "ftPct"
  | "tsPct"
  | "ws"
  | "bpm"
  | "vorp";

export interface StatColumn {
  key: StatKey;
  label: string;
  /** Render as a percentage (.xxx). */
  pct?: boolean;
  /** Decimal places for non-pct values. */
  decimals?: number;
  /** Higher is better (default true) — used by the default sort direction. */
  higherBetter?: boolean;
}

// The redraft table stat columns, in display order.
export const REDRAFT_STAT_COLUMNS: StatColumn[] = [
  { key: "gp", label: "GP", decimals: 0 },
  { key: "ppg", label: "PPG", decimals: 1 },
  { key: "rpg", label: "RPG", decimals: 1 },
  { key: "apg", label: "APG", decimals: 1 },
  { key: "fgPct", label: "FG%", pct: true },
  { key: "fg3Pct", label: "3P%", pct: true },
  { key: "ftPct", label: "FT%", pct: true },
  { key: "tsPct", label: "TS%", pct: true },
  { key: "ws", label: "WS", decimals: 1 },
  { key: "bpm", label: "BPM", decimals: 1 },
  { key: "vorp", label: "VORP", decimals: 1 },
];

export type ProspectStatKey =
  | "age"
  | "ppg"
  | "rpg"
  | "apg"
  | "fgPct"
  | "fg3Pct"
  | "ftPct";

export interface ProspectStatColumn {
  key: ProspectStatKey;
  label: string;
  pct?: boolean;
  decimals?: number;
}

export const PROSPECT_STAT_COLUMNS: ProspectStatColumn[] = [
  { key: "age", label: "AGE", decimals: 1 },
  { key: "ppg", label: "PPG", decimals: 1 },
  { key: "rpg", label: "RPG", decimals: 1 },
  { key: "apg", label: "APG", decimals: 1 },
  { key: "fgPct", label: "FG%", pct: true },
  { key: "fg3Pct", label: "3P%", pct: true },
  { key: "ftPct", label: "FT%", pct: true },
];

export const POSITIONS = ["PG", "SG", "SF", "PF", "C", "G", "F", "G/F", "F/C"];
