import { createClient } from "@/lib/supabase/server";
import type { BigBoard, CareerStats, Player, Prospect } from "@/lib/types";
import type { Database } from "@/lib/supabase/database.types";

type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type StatsRow = Database["public"]["Tables"]["career_stats"]["Row"];
type ProspectRow = Database["public"]["Tables"]["prospects"]["Row"];

const num = (v: number | null) => (v === null ? null : Number(v));

function mapStats(s: StatsRow | null | undefined): CareerStats {
  return {
    gp: s?.gp ?? null,
    mpg: num(s?.mpg ?? null),
    ppg: num(s?.ppg ?? null),
    rpg: num(s?.rpg ?? null),
    apg: num(s?.apg ?? null),
    spg: num(s?.spg ?? null),
    bpg: num(s?.bpg ?? null),
    fgPct: num(s?.fg_pct ?? null),
    fg3Pct: num(s?.fg3_pct ?? null),
    ftPct: num(s?.ft_pct ?? null),
    tsPct: num(s?.ts_pct ?? null),
    ws: num(s?.ws ?? null),
    ws48: num(s?.ws48 ?? null),
    bpm: num(s?.bpm ?? null),
    vorp: num(s?.vorp ?? null),
    seasons: s?.seasons ?? null,
  };
}

function mapPlayer(row: PlayerRow & { career_stats: StatsRow | null }): Player {
  return {
    id: row.id,
    nbaPersonId: row.nba_person_id,
    bbrefSlug: row.bbref_slug,
    name: row.name,
    draftYear: row.draft_year,
    overallPick: row.overall_pick,
    roundNumber: row.round_number,
    team: row.team,
    college: row.college,
    headshotUrl: row.headshot_url,
    stats: mapStats(row.career_stats),
  };
}

function mapProspect(row: ProspectRow): Prospect {
  return {
    id: row.id,
    name: row.name,
    school: row.school,
    classYear: row.class_year,
    position: row.position,
    height: row.height,
    weight: row.weight,
    age: num(row.age),
    ppg: num(row.ppg),
    rpg: num(row.rpg),
    apg: num(row.apg),
    fgPct: num(row.fg_pct),
    fg3Pct: num(row.fg3_pct),
    ftPct: num(row.ft_pct),
    espnId: row.espn_id,
    headshotUrl: row.headshot_url,
    projectedRange: row.projected_range,
    notes: row.notes,
  };
}

// All drafted players for a class, in actual draft order, with career stats.
// Zero-GP / no-career picks are kept — they simply have null stats.
export async function getPlayersByYear(year: number): Promise<Player[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select("*, career_stats(*)")
    .eq("draft_year", year)
    .eq("hidden", false)
    .order("overall_pick", { ascending: true });

  if (error) throw new Error(`Failed to load ${year} class: ${error.message}`);
  return (data ?? []).map((r) =>
    mapPlayer(r as PlayerRow & { career_stats: StatsRow | null }),
  );
}

// The signed-in user's saved redraft order for a year (player id list), or null.
export async function getRedraftOrder(year: number): Promise<string[] | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("redrafts")
    .select("ordered_player_ids")
    .eq("user_id", user.id)
    .eq("draft_year", year)
    .maybeSingle();

  return (data?.ordered_player_ids as string[] | undefined) ?? null;
}

export async function getProspects(): Promise<Prospect[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load prospects: ${error.message}`);
  return (data ?? []).map(mapProspect);
}

// The user's (single) big board, creating a default empty one if none exists.
export async function getBigBoard(): Promise<BigBoard | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("big_boards")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    orderedProspectIds: (data.ordered_prospect_ids as string[]) ?? [],
    tiers: (data.tiers as BigBoard["tiers"]) ?? [],
    notes: (data.notes as Record<string, string>) ?? {},
  };
}

export async function getCurrentUserEmail(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}
