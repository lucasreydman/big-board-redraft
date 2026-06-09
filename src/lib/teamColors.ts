// Team and position accent colors, tuned to read on the dark base rather than
// matching official swatches exactly (several official primaries are too dark).

const NICKNAME_COLORS: Record<string, string> = {
  Hawks: "#E03A3E",
  Celtics: "#00B36B",
  Nets: "#9CA3AF",
  Hornets: "#00A8C8",
  Bulls: "#D7283C",
  Cavaliers: "#B5354F",
  Mavericks: "#2E7BD1",
  Nuggets: "#FEC524",
  Pistons: "#E0353B",
  Warriors: "#FFC72C",
  Rockets: "#DA3A47",
  Pacers: "#FDBB30",
  Clippers: "#E04355",
  Lakers: "#FDB927",
  Grizzlies: "#7C9BC9",
  Heat: "#EB4C6B",
  Bucks: "#3FAE6A",
  Timberwolves: "#4FA8FF",
  Pelicans: "#E31837",
  Knicks: "#F58426",
  Thunder: "#1E9BE9",
  Magic: "#0FA3E8",
  "76ers": "#2E8FE0",
  Suns: "#E56020",
  "Trail Blazers": "#E54550",
  Kings: "#8E6BC1",
  Spurs: "#C4CED4",
  Raptors: "#CE2B50",
  Jazz: "#F9A01B",
  Wizards: "#E31837",
};

/** Accent color for a drafted-by team name like "Dallas Mavericks". */
export function teamColor(team: string | null | undefined): string {
  if (!team) return "#5d6675";
  for (const [nickname, color] of Object.entries(NICKNAME_COLORS)) {
    if (team.endsWith(nickname)) return color;
  }
  return "#5d6675";
}

/** Accent color per prospect position group. */
export function positionColor(position: string | null | undefined): string {
  if (!position) return "#5d6675";
  const p = position.toUpperCase();
  if (p.startsWith("PG") || p === "G") return "#4FA8FF";
  if (p.startsWith("SG") || p === "G/F") return "#2DD4BF";
  if (p.startsWith("SF") || p === "F") return "#F5B942";
  if (p.startsWith("PF") || p === "F/C") return "#FB7E47";
  if (p.startsWith("C")) return "#E0566B";
  return "#5d6675";
}
