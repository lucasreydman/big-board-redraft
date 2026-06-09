"use client";

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
    <div className="border-accent-dim/50 bg-accent/5 flex items-center gap-2 border-y px-4 py-1.5">
      <span className="bg-accent h-3 w-1 rounded-full" />
      <input
        value={label}
        onChange={(e) => onLabel(e.target.value)}
        className="text-accent placeholder:text-accent-dim w-full bg-transparent font-mono text-xs font-semibold uppercase tracking-[0.15em] outline-none"
        placeholder="Tier label"
      />
      <button
        onClick={onRemove}
        aria-label="Remove tier"
        className="text-accent-dim hover:text-down text-sm leading-none transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
