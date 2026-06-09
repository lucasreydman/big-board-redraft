"use client";

import { Check, Loader2, TriangleAlert } from "lucide-react";
import type { SaveState } from "@/hooks/useAutoSave";

const COPY: Record<SaveState, string> = {
  idle: "Saved",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
};

export function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide",
        state === "error"
          ? "border-down/40 text-down"
          : state === "saving"
            ? "border-border text-ink-muted"
            : "border-border text-ink-faint",
      ].join(" ")}
    >
      {state === "saving" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : state === "error" ? (
        <TriangleAlert className="h-3 w-3" />
      ) : (
        <Check className="text-up h-3 w-3" strokeWidth={3} />
      )}
      {COPY[state]}
    </span>
  );
}
