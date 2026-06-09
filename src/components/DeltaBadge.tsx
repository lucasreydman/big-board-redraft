import { ArrowDown, ArrowUp, Minus } from "lucide-react";

// Shows how far a player moved from their actual pick. Positive delta = moved
// up the board (was drafted lower than where you've now slotted them).
export function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="text-ink-faint inline-flex items-center" aria-label="No movement">
        <Minus className="h-3.5 w-3.5" />
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={[
        "tnum inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-sm font-bold",
        up ? "text-up bg-up/10" : "text-down bg-down/10",
      ].join(" ")}
    >
      {up ? (
        <ArrowUp className="h-3.5 w-3.5" strokeWidth={3} />
      ) : (
        <ArrowDown className="h-3.5 w-3.5" strokeWidth={3} />
      )}
      {Math.abs(delta)}
    </span>
  );
}
