"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Headshot } from "@/components/Headshot";
import { DeltaBadge } from "@/components/DeltaBadge";
import { REDRAFT_STAT_COLUMNS } from "@/lib/constants";
import { fmtInt, fmtNum, fmtPct } from "@/lib/format";
import { pickDelta } from "@/lib/format";
import type { Player } from "@/lib/types";

export function RedraftRow({ player, slot }: { player: Player; slot: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id });

  const delta = pickDelta(player.overallPick, slot);

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        "border-border/60 group border-b",
        isDragging
          ? "bg-surface-2 relative z-10 opacity-90 shadow-lg"
          : "hover:bg-surface/60",
      ].join(" ")}
    >
      {/* drag handle */}
      <td className="w-8 pl-3">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag ${player.name}`}
          className="text-ink-faint hover:text-ink cursor-grab touch-none px-1 leading-none active:cursor-grabbing"
        >
          ⠿
        </button>
      </td>

      {/* current slot */}
      <td className="w-10 py-2 text-right">
        <span className="text-ink tnum text-sm font-semibold">{slot}</span>
      </td>

      {/* headshot */}
      <td className="w-12 py-1.5 pl-2">
        <Headshot src={player.headshotUrl} alt={player.name} size={36} />
      </td>

      {/* name + actual pick + delta */}
      <td className="min-w-[200px] py-2 pr-2">
        <div className="flex items-center gap-2">
          <span className="text-ink text-sm font-medium">{player.name}</span>
          <span className="border-border text-ink-faint shrink-0 rounded border px-1.5 py-px font-mono text-[10px]">
            Actual #{player.overallPick}
          </span>
          <DeltaBadge delta={delta} />
        </div>
        <div className="text-ink-faint mt-0.5 text-xs">
          {[player.college, player.team].filter(Boolean).join(" · ") || "—"}
        </div>
      </td>

      {/* stat columns */}
      {REDRAFT_STAT_COLUMNS.map((col) => {
        const v = player.stats[col.key as keyof Player["stats"]] as
          | number
          | null;
        const text = col.pct
          ? fmtPct(v)
          : col.decimals === 0
            ? fmtInt(v)
            : fmtNum(v, col.decimals ?? 1);
        return (
          <td
            key={col.key}
            className={[
              "px-2 py-2 text-right tnum text-sm",
              v === null ? "text-ink-faint" : "text-ink-muted",
            ].join(" ")}
          >
            {text}
          </td>
        );
      })}
    </tr>
  );
}
