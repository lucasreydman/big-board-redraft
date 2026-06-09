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
