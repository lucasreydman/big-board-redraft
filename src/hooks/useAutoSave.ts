"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

// Debounced auto-save. Call `trigger()` whenever the saved payload changes;
// the latest `saver` is invoked after `delay` ms of quiet.
export function useAutoSave(
  saver: () => Promise<void>,
  delay = 700,
): { state: SaveState; trigger: () => void } {
  const [state, setState] = useState<SaveState>("idle");
  const saverRef = useRef(saver);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  saverRef.current = saver;

  const trigger = useCallback(() => {
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await saverRef.current();
        setState("saved");
      } catch {
        setState("error");
      }
    }, delay);
  }, [delay]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { state, trigger };
}
