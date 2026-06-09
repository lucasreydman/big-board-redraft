// Domain types shared across the app. These mirror the Supabase schema but are
// shaped for the UI (camelCase, joined records).

export interface CareerStats {
  gp: number | null;
  mpg: number | null;
  ppg: number | null;
  rpg: number | null;
  apg: number | null;
  spg: number | null;
  bpg: number | null;
  fgPct: number | null;
  fg3Pct: number | null;
  ftPct: number | null;
  tsPct: number | null;
  ws: number | null;
  ws48: number | null;
  bpm: number | null;
  vorp: number | null;
  seasons: number | null;
}

export interface Player {
  id: string;
  nbaPersonId: number | null;
  bbrefSlug: string | null;
  name: string;
  draftYear: number;
  /** Where the player was actually drafted. */
  overallPick: number;
  roundNumber: number | null;
  team: string | null;
  college: string | null;
  headshotUrl: string | null;
  stats: CareerStats;
}

export interface Prospect {
  id: string;
  name: string;
  school: string | null;
  classYear: string | null;
  position: string | null;
  height: string | null;
  weight: number | null;
  age: number | null;
  ppg: number | null;
  rpg: number | null;
  apg: number | null;
  fgPct: number | null;
  fg3Pct: number | null;
  ftPct: number | null;
  espnId: string | null;
  headshotUrl: string | null;
  projectedRange: string | null;
  notes: string | null;
}

export interface Tier {
  /** Index in the ordered list *before* which this divider sits. */
  position: number;
  label: string;
}

export interface BigBoard {
  id: string;
  name: string;
  orderedProspectIds: string[];
  tiers: Tier[];
  notes: Record<string, string>;
}
