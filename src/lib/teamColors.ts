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

const NICKNAME_ABBR: Record<string, string> = {
  Hawks: "ATL",
  Celtics: "BOS",
  Nets: "BKN",
  Hornets: "CHA",
  Bulls: "CHI",
  Cavaliers: "CLE",
  Mavericks: "DAL",
  Nuggets: "DEN",
  Pistons: "DET",
  Warriors: "GSW",
  Rockets: "HOU",
  Pacers: "IND",
  Clippers: "LAC",
  Lakers: "LAL",
  Grizzlies: "MEM",
  Heat: "MIA",
  Bucks: "MIL",
  Timberwolves: "MIN",
  Pelicans: "NOP",
  Knicks: "NYK",
  Thunder: "OKC",
  Magic: "ORL",
  "76ers": "PHI",
  Suns: "PHX",
  "Trail Blazers": "POR",
  Kings: "SAC",
  Spurs: "SAS",
  Raptors: "TOR",
  Jazz: "UTA",
  Wizards: "WAS",
};

/** Accent color for a drafted-by team name like "Dallas Mavericks". */
export function teamColor(team: string | null | undefined): string {
  if (!team) return "#5d6675";
  for (const [nickname, color] of Object.entries(NICKNAME_COLORS)) {
    if (team.endsWith(nickname)) return color;
  }
  return "#5d6675";
}

/** Three-letter abbreviation for a team name like "Dallas Mavericks". */
export function teamAbbr(team: string | null | undefined): string | null {
  if (!team) return null;
  for (const [nickname, abbr] of Object.entries(NICKNAME_ABBR)) {
    if (team.endsWith(nickname)) return abbr;
  }
  return null;
}

const NICKNAME_NBA_ID: Record<string, number> = {
  Hawks: 1610612737,
  Celtics: 1610612738,
  Nets: 1610612751,
  Hornets: 1610612766,
  Bulls: 1610612741,
  Cavaliers: 1610612739,
  Mavericks: 1610612742,
  Nuggets: 1610612743,
  Pistons: 1610612765,
  Warriors: 1610612744,
  Rockets: 1610612745,
  Pacers: 1610612754,
  Clippers: 1610612746,
  Lakers: 1610612747,
  Grizzlies: 1610612763,
  Heat: 1610612748,
  Bucks: 1610612749,
  Timberwolves: 1610612750,
  Pelicans: 1610612740,
  Knicks: 1610612752,
  Thunder: 1610612760,
  Magic: 1610612753,
  "76ers": 1610612755,
  Suns: 1610612756,
  "Trail Blazers": 1610612757,
  Kings: 1610612758,
  Spurs: 1610612759,
  Raptors: 1610612761,
  Jazz: 1610612762,
  Wizards: 1610612764,
};

/** Official NBA logo URL for a team name like "Dallas Mavericks". */
export function teamLogoUrl(team: string | null | undefined): string | null {
  if (!team) return null;
  for (const [nickname, id] of Object.entries(NICKNAME_NBA_ID)) {
    if (team.endsWith(nickname))
      return `https://cdn.nba.com/logos/nba/${id}/global/L/logo.svg`;
  }
  return null;
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
