// Completed classes available for redraft mode.
export const REDRAFT_YEARS = [
  2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
] as const;

export const PROSPECT_YEAR = 2026;

/** Sentinel overall_pick base for undrafted players (101, 102, … per class). */
export const UDFA_PICK = 100;

/** Per-user cut pile (cut from board / top-30 trim / restore). Off while every
 * class is pre-trimmed to a clean top 30 — flip to re-enable the feature. */
export const CUTS_ENABLED = false;

/** For movement math, every UDFA counts as "pick 61" — one past the draft. */
export const UDFA_VALUE_PICK = 61;

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
  /** Responsive visibility — static Tailwind classes per cell/header. */
  cellClass?: string;
}

// The redraft table stat columns, in display order. Headline stats stay
// visible on small screens; the long tail appears at md/lg.
export const REDRAFT_STAT_COLUMNS: StatColumn[] = [
  { key: "gp", label: "GP", decimals: 0, cellClass: "hidden lg:inline-flex" },
  { key: "ppg", label: "PPG", decimals: 1 },
  { key: "rpg", label: "RPG", decimals: 1 },
  { key: "apg", label: "APG", decimals: 1 },
  { key: "fgPct", label: "FG%", pct: true, cellClass: "hidden lg:inline-flex" },
  { key: "fg3Pct", label: "3P%", pct: true, cellClass: "hidden lg:inline-flex" },
  { key: "ftPct", label: "FT%", pct: true, cellClass: "hidden xl:inline-flex" },
  { key: "tsPct", label: "TS%", pct: true, cellClass: "hidden md:inline-flex" },
  { key: "ws", label: "WS", decimals: 1 },
  { key: "bpm", label: "BPM", decimals: 1, cellClass: "hidden md:inline-flex" },
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
  /** Responsive visibility — static Tailwind classes per cell/header. */
  cellClass?: string;
}

export const PROSPECT_STAT_COLUMNS: ProspectStatColumn[] = [
  { key: "age", label: "AGE", decimals: 1, cellClass: "hidden lg:inline-flex" },
  { key: "ppg", label: "PPG", decimals: 1 },
  { key: "rpg", label: "RPG", decimals: 1 },
  { key: "apg", label: "APG", decimals: 1 },
  { key: "fgPct", label: "FG%", pct: true, cellClass: "hidden md:inline-flex" },
  { key: "fg3Pct", label: "3P%", pct: true },
  { key: "ftPct", label: "FT%", pct: true, cellClass: "hidden md:inline-flex" },
];

export const POSITIONS = ["PG", "SG", "SF", "PF", "C", "G", "F", "G/F", "F/C"];
