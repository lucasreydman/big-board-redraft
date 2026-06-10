"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ListPlus, StickyNote, X } from "lucide-react";
import { Headshot } from "@/components/Headshot";
import { TeamLogo } from "@/components/redraft/TeamLogo";
import { positionColor } from "@/lib/teamColors";
import {
  PROSPECT_STAT_COLUMNS,
  type ProspectStatKey,
} from "@/lib/constants";
import { fmtNum, fmtPct } from "@/lib/format";
import { heatClass, type HeatLevel } from "@/lib/heat";
import type { Prospect } from "@/lib/types";

export function ProspectRow({
  prospect,
  rank,
  slotTeam,
  note,
  notesOpen,
  draggable,
  heat,
  onNoteChange,
  onToggleNotes,
  onInsertTierAbove,
  onRemove,
}: {
  prospect: Prospect;
  rank: number;
  /** Franchise owning this draft slot — shows its logo beside the rank. */
  slotTeam: string | null;
  note: string;
  notesOpen: boolean;
  draggable: boolean;
  heat: (key: ProspectStatKey, value: number | null) => HeatLevel;
  onNoteChange: (v: string) => void;
  onToggleNotes: () => void;
  onInsertTierAbove: (() => void) | null;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prospect.id, disabled: !draggable });

  const accent = positionColor(prospect.position);
  const sub = [
    prospect.classYear,
    prospect.height,
    prospect.weight ? `${prospect.weight} lb` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
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
      <div className="flex h-20 items-center gap-2 px-2">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag ${prospect.name}`}
          disabled={!draggable}
          className="text-ink-faint hover:text-ink cursor-grab touch-none rounded p-1.5 transition-colors active:cursor-grabbing disabled:cursor-default disabled:opacity-20"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <span
          className={[
            "display w-11 shrink-0 text-right text-3xl font-bold leading-none",
            rank <= 14 ? "text-accent" : "text-ink-muted",
          ].join(" ")}
        >
          {rank}
        </span>

        <span className="flex w-11 shrink-0 items-center justify-center">
          <TeamLogo team={slotTeam} size={40} />
        </span>

        <div className="pl-2">
          <Headshot
            src={prospect.headshotUrl}
            alt={prospect.name}
            size={64}
            accent={accent}
          />
        </div>

        <div className="min-w-[220px] flex-1 pl-2">
          <div className="flex items-center gap-2.5">
            <span className="display text-ink truncate text-2xl font-bold leading-tight">
              {prospect.name}
            </span>
            {prospect.projectedRange && (
              <span className="border-border text-ink-faint tnum shrink-0 rounded border px-1.5 py-0.5 text-[11px]">
                {prospect.projectedRange}
              </span>
            )}
          </div>
          <div className="text-ink-muted mt-1 flex items-center gap-2 text-[13px] leading-tight">
            {prospect.position && (
              <span
                className="shrink-0 font-mono font-semibold"
                style={{ color: accent }}
              >
                {prospect.position}
              </span>
            )}
            <span className="truncate">
              {[prospect.school, sub].filter(Boolean).join(" — ") || "—"}
            </span>
          </div>
        </div>

        {/* stat columns */}
        <div className="flex items-center">
          {PROSPECT_STAT_COLUMNS.map((col) => {
            const v = prospect[col.key];
            const text = col.pct
              ? fmtPct(v != null ? v / 100 : null)
              : fmtNum(v, col.decimals ?? 1);
            return (
              <span
                key={col.key}
                className={[
                  // text-[15px] not text-base: "base" is a theme COLOR here.
                  "tnum w-16 justify-end text-right text-[15px]",
                  col.cellClass ?? "inline-flex",
                  v == null
                    ? "text-ink-faint/60"
                    : heatClass(heat(col.key, v)),
                ].join(" ")}
              >
                {text}
              </span>
            );
          })}
        </div>

        {/* row actions */}
        <div className="ml-2 flex w-24 items-center justify-end gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 has-[[data-active=true]]:opacity-100">
          {onInsertTierAbove && (
            <RowAction title="Insert tier above" onClick={onInsertTierAbove}>
              <ListPlus className="h-4 w-4" />
            </RowAction>
          )}
          <RowAction
            title="Notes"
            onClick={onToggleNotes}
            active={notesOpen || note.length > 0}
          >
            <StickyNote className="h-4 w-4" />
          </RowAction>
          <RowAction title="Remove from board" onClick={onRemove} danger>
            <X className="h-4 w-4" />
          </RowAction>
        </div>
      </div>

      {notesOpen && (
        <div className="bg-surface-2/40 px-16 pb-3">
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={2}
            autoFocus
            placeholder={`Notes on ${prospect.name}…`}
            className="bg-surface border-border focus:border-accent text-ink w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
          />
        </div>
      )}
    </div>
  );
}

function RowAction({
  children,
  title,
  onClick,
  active,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      data-active={active ? "true" : undefined}
      className={[
        "cursor-pointer rounded-md p-1.5 transition-colors duration-150",
        active
          ? "text-accent"
          : danger
            ? "text-ink-faint hover:text-down"
            : "text-ink-faint hover:text-ink",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
