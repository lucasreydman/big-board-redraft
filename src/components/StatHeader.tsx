"use client";

import type { SortDir } from "@/lib/sort";

// A clickable, right-aligned stat column header. Shows the active sort arrow.
export function StatHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className="px-2 py-2 text-right font-medium">
      <button
        onClick={onClick}
        className={[
          "hover:text-ink ml-auto inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide transition-colors",
          active ? "text-accent" : "text-ink-faint",
        ].join(" ")}
      >
        {label}
        <span className="w-2 text-[9px]">
          {active ? (dir === "desc" ? "▼" : "▲") : ""}
        </span>
      </button>
    </th>
  );
}
