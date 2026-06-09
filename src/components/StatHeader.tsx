"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { SortDir } from "@/lib/sort";

// A clickable, right-aligned stat column header. Shows the active sort arrow.
export function StatHeader({
  label,
  active,
  dir,
  onClick,
  className = "",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`px-2 py-2.5 text-right font-medium ${className}`}>
      <button
        onClick={onClick}
        aria-label={`Sort by ${label}`}
        className={[
          "hover:text-ink ml-auto inline-flex cursor-pointer items-center gap-0.5 font-mono text-[11px] uppercase tracking-wide transition-colors duration-150",
          active ? "text-accent" : "text-ink-faint",
        ].join(" ")}
      >
        {label}
        <span className="inline-flex w-3 justify-center">
          {active &&
            (dir === "desc" ? (
              <ChevronDown className="h-3 w-3" strokeWidth={3} />
            ) : (
              <ChevronUp className="h-3 w-3" strokeWidth={3} />
            ))}
        </span>
      </button>
    </th>
  );
}
