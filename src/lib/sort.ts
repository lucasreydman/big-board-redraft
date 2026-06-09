import type { Player, Prospect } from "@/lib/types";
import type { StatKey, ProspectStatKey } from "@/lib/constants";

export type SortDir = "asc" | "desc";

function playerStat(p: Player, key: StatKey): number | null {
  return p.stats[key as keyof Player["stats"]] as number | null;
}

// Sort player ids by a stat. Nulls always sink to the bottom regardless of
// direction so zero-/no-career picks don't crowd the top.
export function sortPlayerIds(
  players: Player[],
  ids: string[],
  key: StatKey,
  dir: SortDir,
): string[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const mult = dir === "desc" ? -1 : 1;
  return [...ids].sort((a, b) => {
    const pa = byId.get(a);
    const pb = byId.get(b);
    if (!pa || !pb) return 0;
    const va = playerStat(pa, key);
    const vb = playerStat(pb, key);
    if (va === null && vb === null) return pa.overallPick - pb.overallPick;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va === vb) return pa.overallPick - pb.overallPick;
    return (va - vb) * mult;
  });
}

export function sortProspectIds(
  prospects: Prospect[],
  ids: string[],
  key: ProspectStatKey,
  dir: SortDir,
): string[] {
  const byId = new Map(prospects.map((p) => [p.id, p]));
  const mult = dir === "desc" ? -1 : 1;
  return [...ids].sort((a, b) => {
    const pa = byId.get(a);
    const pb = byId.get(b);
    if (!pa || !pb) return 0;
    const va = pa[key];
    const vb = pb[key];
    if (va == null && vb == null) return pa.name.localeCompare(pb.name);
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va === vb) return pa.name.localeCompare(pb.name);
    return (va - vb) * mult;
  });
}
