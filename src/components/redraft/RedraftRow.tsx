"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  GripVertical,
  Info,
  MoreVertical,
  SendHorizontal,
} from "lucide-react";
import { Headshot } from "@/components/Headshot";
import { DeltaBadge } from "@/components/DeltaBadge";
import { teamColor } from "@/lib/teamColors";
import { REDRAFT_STAT_COLUMNS, type StatKey } from "@/lib/constants";
import { fmtInt, fmtNum, fmtPct, pickDelta } from "@/lib/format";
import { heatClass, type HeatLevel } from "@/lib/heat";
import type { Player } from "@/lib/types";

export function RedraftRow({
  player,
  slot,
  total,
  draggable,
  heat,
  onOpen,
  onMoveTo,
}: {
  player: Player;
  slot: number;
  total: number;
  draggable: boolean;
  heat: (key: StatKey, value: number | null) => HeatLevel;
  onOpen: () => void;
  onMoveTo: (slot: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id, disabled: !draggable });

  const delta = pickDelta(player.overallPick, slot);
  const accent = teamColor(player.team);

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        boxShadow: `inset 3px 0 0 0 ${accent}`,
      }}
      className={[
        "border-border/70 group border-b",
        isDragging
          ? "bg-surface-3 relative z-10 opacity-50"
          : "hover:bg-surface-2/70 transition-colors duration-150",
      ].join(" ")}
    >
      {/* drag handle */}
      <td className="w-9 pl-2">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag ${player.name}`}
          disabled={!draggable}
          className="text-ink-faint hover:text-ink cursor-grab touch-none rounded p-1.5 transition-colors active:cursor-grabbing disabled:cursor-default disabled:opacity-20"
        >
          <GripVertical className="h-5 w-5" />
        </button>
      </td>

      {/* current slot */}
      <td className="w-12 py-3 pr-1 text-right">
        <span
          className={[
            "display text-2xl font-bold leading-none",
            slot <= 14 ? "text-accent" : "text-ink-muted",
          ].join(" ")}
        >
          {slot}
        </span>
      </td>

      {/* headshot */}
      <td className="w-[72px] py-2 pl-3">
        <Headshot
          src={player.headshotUrl}
          alt={player.name}
          size={56}
          accent={accent}
        />
      </td>

      {/* name + actual pick + delta */}
      <td className="min-w-[230px] py-2 pl-3 pr-2">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpen}
            className="display text-ink hover:text-accent cursor-pointer truncate text-left text-xl font-bold leading-tight transition-colors duration-150"
          >
            {player.name}
          </button>
          <DeltaBadge delta={delta} />
        </div>
        <div className="text-ink-faint mt-1 flex items-center gap-2 text-xs">
          <span className="tnum shrink-0 font-medium" style={{ color: accent }}>
            #{player.overallPick}
          </span>
          <span className="truncate">
            {[player.college, player.team].filter(Boolean).join(" · ") || "—"}
          </span>
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
              "tnum px-2 py-2 text-right text-[15px]",
              col.cellClass ?? "",
              v === null ? "text-ink-faint/60" : heatClass(heat(col.key, v)),
            ].join(" ")}
          >
            {text}
          </td>
        );
      })}

      {/* row actions */}
      <td className="w-10 pr-2 text-right">
        <RowMenu
          name={player.name}
          slot={slot}
          total={total}
          enabled={draggable}
          onOpen={onOpen}
          onMoveTo={onMoveTo}
        />
      </td>
    </tr>
  );
}

function RowMenu({
  name,
  slot,
  total,
  enabled,
  onOpen,
  onMoveTo,
}: {
  name: string;
  slot: number;
  total: number;
  enabled: boolean;
  onOpen: () => void;
  onMoveTo: (slot: number) => void;
}) {
  const [target, setTarget] = useState("");

  function sendToSlot() {
    const n = parseInt(target, 10);
    if (!Number.isNaN(n)) onMoveTo(Math.min(Math.max(n, 1), total));
    setTarget("");
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={`Actions for ${name}`}
          className="text-ink-faint hover:text-ink cursor-pointer rounded-md p-1.5 opacity-0 transition-all duration-150 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="bg-surface-2 border-border z-30 w-52 rounded-lg border p-1 shadow-xl"
        >
          <MenuItem onSelect={onOpen}>
            <Info className="h-3.5 w-3.5" /> View details
          </MenuItem>
          {enabled && (
            <>
              <MenuItem onSelect={() => onMoveTo(1)} disabled={slot === 1}>
                <ArrowUpToLine className="h-3.5 w-3.5" /> Move to top
              </MenuItem>
              <MenuItem
                onSelect={() => onMoveTo(total)}
                disabled={slot === total}
              >
                <ArrowDownToLine className="h-3.5 w-3.5" /> Move to bottom
              </MenuItem>
              <div
                className="border-border mt-1 flex items-center gap-1.5 border-t p-2"
                onKeyDown={(e) => e.stopPropagation()}
              >
                <input
                  value={target}
                  onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && sendToSlot()}
                  placeholder={`Slot 1–${total}`}
                  inputMode="numeric"
                  className="bg-surface border-border focus:border-accent tnum w-full rounded-md border px-2 py-1 text-xs outline-none"
                />
                <button
                  onClick={sendToSlot}
                  aria-label="Send to slot"
                  className="text-accent hover:bg-surface-3 cursor-pointer rounded-md p-1.5 transition-colors"
                >
                  <SendHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({
  children,
  onSelect,
  disabled,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className="text-ink-muted data-[highlighted]:bg-surface-3 data-[highlighted]:text-ink flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-xs outline-none data-[disabled]:cursor-default data-[disabled]:opacity-30"
    >
      {children}
    </DropdownMenu.Item>
  );
}
