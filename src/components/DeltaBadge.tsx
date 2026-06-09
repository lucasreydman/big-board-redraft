import { fmtDelta } from "@/lib/format";

// Shows how far a player moved from their actual pick. Positive delta = moved
// up the board (was drafted lower than where you've now slotted them).
export function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className="text-ink-faint font-mono text-xs">—</span>;
  }
  const up = delta > 0;
  return (
    <span
      className={[
        "font-mono text-xs font-medium tabular-nums",
        up ? "text-up" : "text-down",
      ].join(" ")}
    >
      {fmtDelta(delta)}
    </span>
  );
}
