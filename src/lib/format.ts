// Stat formatting helpers. Empty / zero-GP careers should render as a dash
// rather than 0.0 or NaN.

export function fmtNum(
  value: number | null | undefined,
  decimals = 1,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(decimals);
}

export function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  // Stored as a 0–1 ratio; show as .xxx (or 1.000 for a perfect mark).
  if (value >= 1) return value.toFixed(3);
  return value.toFixed(3).replace(/^0/, "");
}

export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Math.round(value).toString();
}

// Delta between actual pick and redraft slot. Positive = moved up the board.
export function pickDelta(actualPick: number, redraftSlot: number): number {
  return actualPick - redraftSlot;
}

export function fmtDelta(delta: number): string {
  if (delta === 0) return "—";
  return delta > 0 ? `▲ ${delta}` : `▼ ${Math.abs(delta)}`;
}
