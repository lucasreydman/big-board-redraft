"use client";

import { X } from "lucide-react";

// A labeled tier divider that sits between prospects. It occupies a fixed slot
// in the board, so dragging prospects across it moves them between tiers.
export function TierDivider({
  label,
  onLabel,
  onRemove,
}: {
  label: string;
  onLabel: (next: string) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2"
      style={{
        background:
          "linear-gradient(90deg, rgba(245,185,66,.14) 0%, rgba(245,185,66,.03) 60%, transparent 100%)",
        boxShadow:
          "inset 0 1px 0 0 rgba(245,185,66,.35), inset 0 -1px 0 0 rgba(245,185,66,.35)",
      }}
    >
      <span className="bg-accent h-5 w-1.5 shrink-0 rounded-full" />
      <input
        value={label}
        onChange={(e) => onLabel(e.target.value)}
        className="display text-accent placeholder:text-accent-dim w-full bg-transparent text-lg font-bold tracking-wide outline-none"
        placeholder="TIER LABEL"
      />
      <button
        onClick={onRemove}
        aria-label="Remove tier"
        className="text-accent-dim hover:text-down cursor-pointer rounded-md p-1 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// A fixed structural divider (e.g. the round break). Unlike a tier it isn't
// stored on the board, can't be edited or removed, and never moves.
export function RoundDivider({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2"
      style={{
        background:
          "linear-gradient(90deg, rgba(93,102,117,.20) 0%, rgba(93,102,117,.05) 60%, transparent 100%)",
        boxShadow:
          "inset 0 1px 0 0 rgba(93,102,117,.5), inset 0 -1px 0 0 rgba(93,102,117,.5)",
      }}
    >
      <span className="bg-ink-faint h-5 w-1.5 shrink-0 rounded-full" />
      <span className="display text-ink-muted text-lg font-bold uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}
