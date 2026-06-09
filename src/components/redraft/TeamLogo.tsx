"use client";

import { useState } from "react";
import { teamAbbr, teamColor, teamLogoUrl } from "@/lib/teamColors";

// Official NBA logo with a colored-abbreviation fallback if the CDN fails.
export function TeamLogo({
  team,
  size = 28,
}: {
  team: string | null | undefined;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const url = teamLogoUrl(team);
  const abbr = teamAbbr(team);

  if (!url || failed) {
    return abbr ? (
      <span
        className="tnum text-[11px] font-bold"
        style={{ color: teamColor(team) }}
        title={team ?? undefined}
      >
        {abbr}
      </span>
    ) : (
      <span className="text-ink-faint text-[11px]">—</span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={team ?? "team logo"}
      title={team ?? undefined}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="object-contain"
      style={{ width: size, height: size }}
    />
  );
}
