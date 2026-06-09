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
import { teamAbbr, teamColor } from "@/lib/teamColors";
import { REDRAFT_STAT_COLUMNS, UDFA_PICK, type StatKey } from "@/lib/constants";
import { fmtInt, fmtNum, fmtPct, pickDelta } from "@/lib/format";
import { heatClass, type HeatLevel } from "@/lib/heat";
import type { Player } from "@/lib/types";

export function RedraftRow({
  player,
  slot,
  slotTeam,
  total,
  draggable,
  heat,
  onOpen,
  onMoveTo,
}: {
  player: Player;
  slot: number;
  /** The franchise that actually owned this slot's pick on draft night. */
  slotTeam: string | null;
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

  const isUdfa = player.overallPick >= UDFA_PICK;
  const playerAccent = teamColor(player.team);
  const slotAccent = teamColor(slotTeam);
  const slotAbbr = teamAbbr(slotTeam);

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        boxShadow: `inset 3px 0 0 0 ${slotTeam ? slotAccent : "transparent"}`,
      }}
      className={[
        "border-border/70 group border-b",
        isDragging
          ? "bg-surface-3 relative z-10 opacity-50"
          : "hover:bg-surface-2/70 transition-colors duration-150",
      ].join(" ")}
    >
      {/* drag handle */}
      <td className="w-8 pl-1.5">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag ${player.name}`}
          disabled={!draggable}
          className="text-ink-faint hover:text-ink cursor-grab touch-none rounded p-1 transition-colors active:cursor-grabbing disabled:cursor-default disabled:opacity-20"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>

      {/* slot + the team that owned this pick (anchored to the slot, not the player) */}
      <td className="w-10 py-1.5 pr-1 text-right">
        <span
          className={[
            "display text-xl font-bold leading-none",
            slot <= 14 ? "text-accent" : "text-ink-muted",
          ].join(" ")}
        >
          {slot}
        </span>
      </td>
      <td className="w-12 py-1.5 pl-2">
        {slotAbbr ? (
          <span
            className="tnum rounded px-1.5 py-0.5 text-[11px] font-bold"
            style={{ color: slotAccent, background: `${slotAccent}1a` }}
            title={slotTeam ?? undefined}
          >
            {slotAbbr}
          </span>
        ) : (
          <span className="text-ink-faint text-[11px]">—</span>
        )}
      </td>

      {/* headshot */}
      <td className="w-[54px] py-1.5 pl-1">
        <Headshot
          src={player.headshotUrl}
          alt={player.name}
          size={44}
          accent={playerAccent}
        />
      </td>

      {/* name + actual pick + delta */}
      <td className="min-w-[210px] py-1.5 pl-2.5 pr-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onOpen}
            className="display text-ink hover:text-accent cursor-pointer truncate text-left text-lg font-bold leading-tight transition-colors duration-150"
          >
            {player.name}
          </button>
          {isUdfa ? (
            <span className="border-accent/40 text-accent shrink-0 rounded border px-1 py-px font-mono text-[9px] font-semibold uppercase">
              UDFA
            </span>
          ) : (
            <DeltaBadge delta={pickDelta(player.overallPick, slot)} />
          )}
        </div>
        <div className="text-ink-faint mt-0.5 flex items-center gap-1.5 text-[11px] leading-tight">
          {!isUdfa && (
            <span
              className="tnum shrink-0 font-semibold"
              style={{ color: playerAccent }}
            >
              #{player.overallPick}
            </span>
          )}
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
              "tnum px-2 py-1.5 text-right text-sm",
              col.cellClass ?? "",
              v === null ? "text-ink-faint/60" : heatClass(heat(col.key, v)),
            ].join(" ")}
          >
            {text}
          </td>
        );
      })}

      {/* row actions */}
      <td className="w-9 pr-1.5 text-right">
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
          className="text-ink-faint hover:text-ink cursor-pointer rounded-md p-1 opacity-0 transition-all duration-150 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
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
