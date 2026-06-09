"use client";

import type { SaveState } from "@/hooks/useAutoSave";

const COPY: Record<SaveState, string> = {
  idle: "All changes saved",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
};

export function SaveIndicator({ state }: { state: SaveState }) {
  const color =
    state === "error"
      ? "bg-down"
      : state === "saving"
        ? "bg-accent animate-pulse"
        : "bg-up";
  return (
    <span className="text-ink-muted inline-flex items-center gap-1.5 font-mono text-xs">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {COPY[state]}
    </span>
  );
}
