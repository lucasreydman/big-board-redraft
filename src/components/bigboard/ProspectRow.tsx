"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Headshot } from "@/components/Headshot";
import { PROSPECT_STAT_COLUMNS } from "@/lib/constants";
import { fmtNum, fmtPct } from "@/lib/format";
import type { Prospect } from "@/lib/types";

export function ProspectRow({
  prospect,
  rank,
  note,
  notesOpen,
  draggable,
  onNoteChange,
  onToggleNotes,
  onInsertTierAbove,
  onRemove,
}: {
  prospect: Prospect;
  rank: number;
  note: string;
  notesOpen: boolean;
  draggable: boolean;
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

  const sub = [
    prospect.position,
    prospect.classYear,
    prospect.height,
    prospect.weight ? `${prospect.weight} lb` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        "border-border/60 group border-b",
        isDragging ? "bg-surface-2 relative z-10 opacity-90 shadow-lg" : "",
      ].join(" ")}
    >
      <div className="hover:bg-surface/60 flex items-center gap-2 px-3 py-1.5">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag ${prospect.name}`}
          disabled={!draggable}
          className="text-ink-faint hover:text-ink w-5 cursor-grab touch-none leading-none active:cursor-grabbing disabled:cursor-default disabled:opacity-30"
        >
          ⠿
        </button>

        <span className="tnum text-ink w-7 text-right text-sm font-semibold">
          {rank}
        </span>

        <Headshot src={prospect.headshotUrl} alt={prospect.name} size={36} />

        <div className="min-w-[180px] flex-1">
          <div className="flex items-center gap-2">
            <span className="text-ink text-sm font-medium">
              {prospect.name}
            </span>
            {prospect.projectedRange && (
              <span className="border-border text-ink-faint rounded border px-1.5 py-px font-mono text-[10px]">
                {prospect.projectedRange}
              </span>
            )}
          </div>
          <div className="text-ink-faint mt-0.5 text-xs">
            {[prospect.school, sub].filter(Boolean).join(" — ") || "—"}
          </div>
        </div>

        {/* stat columns */}
        <div className="flex items-center">
          {PROSPECT_STAT_COLUMNS.map((col) => {
            const v = prospect[col.key];
            const text = col.pct ? fmtPct(v) : fmtNum(v, col.decimals ?? 1);
            return (
              <span
                key={col.key}
                className={[
                  "tnum w-14 text-right text-sm",
                  v == null ? "text-ink-faint" : "text-ink-muted",
                ].join(" ")}
              >
                {text}
              </span>
            );
          })}
        </div>

        {/* row actions */}
        <div className="ml-2 flex w-24 items-center justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onInsertTierAbove && (
            <RowAction title="Insert tier above" onClick={onInsertTierAbove}>
              ＋tier
            </RowAction>
          )}
          <RowAction
            title="Notes"
            onClick={onToggleNotes}
            active={notesOpen || note.length > 0}
          >
            ✎
          </RowAction>
          <RowAction title="Remove from board" onClick={onRemove}>
            ✕
          </RowAction>
        </div>
      </div>

      {notesOpen && (
        <div className="bg-surface-2/40 px-12 pb-2">
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={2}
            placeholder={`Notes on ${prospect.name}…`}
            className="bg-surface border-border focus:border-accent text-ink w-full rounded-md border px-3 py-2 text-sm outline-none"
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
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={[
        "rounded px-1 font-mono text-[11px] leading-5 transition-colors",
        active
          ? "text-accent"
          : "text-ink-faint hover:text-ink",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
