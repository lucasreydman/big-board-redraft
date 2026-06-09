"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, X } from "lucide-react";
import { Headshot } from "@/components/Headshot";
import { teamColor } from "@/lib/teamColors";
import { fmtInt, fmtNum, fmtPct } from "@/lib/format";
import type { Player } from "@/lib/types";

// Right-side detail sheet for a drafted player: the full career line that
// doesn't fit in the table, plus source links.
export function PlayerDrawer({
  player,
  slot,
  onClose,
}: {
  player: Player | null;
  slot: number | null;
  onClose: () => void;
}) {
  const accent = teamColor(player?.team);
  const s = player?.stats;

  return (
    <Dialog.Root open={player !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="bg-surface border-border fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l shadow-2xl outline-none"
          aria-describedby={undefined}
        >
          {player && s && (
            <>
              <div
                className="relative px-6 pb-5 pt-6"
                style={{
                  background: `linear-gradient(160deg, ${accent}26 0%, transparent 55%)`,
                }}
              >
                <Dialog.Close
                  aria-label="Close"
                  className="text-ink-muted hover:text-ink absolute right-4 top-4 cursor-pointer rounded-md p-1 transition-colors"
                >
                  <X className="h-5 w-5" />
                </Dialog.Close>

                <div className="flex items-end gap-4">
                  <Headshot
                    src={player.headshotUrl}
                    alt={player.name}
                    size={104}
                    accent={accent}
                  />
                  <div className="min-w-0 pb-1">
                    <Dialog.Title className="display text-ink truncate text-3xl font-bold leading-none">
                      {player.name}
                    </Dialog.Title>
                    <div className="text-ink-muted mt-2 text-sm">
                      {[player.college, player.team]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                    <div className="tnum text-ink-faint mt-1 text-xs">
                      {player.draftYear} Draft · Pick #{player.overallPick}
                      {player.roundNumber ? ` · Round ${player.roundNumber}` : ""}
                      {slot ? ` · Your slot #${slot}` : ""}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5 px-6 pb-8">
                <StatSection
                  title="Per game"
                  accent={accent}
                  items={[
                    ["PPG", fmtNum(s.ppg)],
                    ["RPG", fmtNum(s.rpg)],
                    ["APG", fmtNum(s.apg)],
                    ["SPG", fmtNum(s.spg)],
                    ["BPG", fmtNum(s.bpg)],
                    ["MPG", fmtNum(s.mpg)],
                  ]}
                />
                <StatSection
                  title="Shooting"
                  accent={accent}
                  items={[
                    ["FG%", fmtPct(s.fgPct)],
                    ["3P%", fmtPct(s.fg3Pct)],
                    ["FT%", fmtPct(s.ftPct)],
                    ["TS%", fmtPct(s.tsPct)],
                  ]}
                />
                <StatSection
                  title="Career value"
                  accent={accent}
                  items={[
                    ["GP", fmtInt(s.gp)],
                    ["Seasons", fmtInt(s.seasons)],
                    ["WS", fmtNum(s.ws)],
                    ["WS/48", fmtNum(s.ws48, 3)],
                    ["BPM", fmtNum(s.bpm)],
                    ["VORP", fmtNum(s.vorp)],
                  ]}
                />

                <div className="flex flex-wrap gap-2 pt-1">
                  {player.bbrefSlug && (
                    <SourceLink
                      href={`https://www.basketball-reference.com/players/${player.bbrefSlug[0]}/${player.bbrefSlug}.html`}
                      label="Basketball Reference"
                    />
                  )}
                  {player.nbaPersonId && (
                    <SourceLink
                      href={`https://www.nba.com/player/${player.nbaPersonId}`}
                      label="NBA.com"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StatSection({
  title,
  accent,
  items,
}: {
  title: string;
  accent: string;
  items: [string, string][];
}) {
  return (
    <section>
      <h3
        className="display border-b pb-1.5 text-sm font-semibold tracking-wide"
        style={{ borderColor: `${accent}40`, color: accent }}
      >
        {title}
      </h3>
      <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-ink-faint font-mono text-[10px] uppercase tracking-wider">
              {label}
            </dt>
            <dd className="tnum text-ink mt-0.5 text-xl font-semibold">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="border-border text-ink-muted hover:border-border-strong hover:text-ink inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors duration-150"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
