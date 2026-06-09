"use client";

import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { RedraftRow } from "./RedraftRow";
import { StatHeader } from "@/components/StatHeader";
import { SaveIndicator } from "@/components/SaveIndicator";
import { useAutoSave } from "@/hooks/useAutoSave";
import { createClient } from "@/lib/supabase/client";
import { sortPlayerIds, type SortDir } from "@/lib/sort";
import { REDRAFT_STAT_COLUMNS, type StatKey } from "@/lib/constants";
import { fmtInt, fmtNum, fmtPct, pickDelta } from "@/lib/format";
import { exportCsv, exportPng } from "@/lib/export";
import type { Player } from "@/lib/types";

export function RedraftTable({
  year,
  players,
  initialOrder,
}: {
  year: number;
  players: Player[];
  initialOrder: string[];
}) {
  const byId = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );
  const actualOrder = useMemo(
    () =>
      [...players]
        .sort((a, b) => a.overallPick - b.overallPick)
        .map((p) => p.id),
    [players],
  );

  const [order, setOrder] = useState<string[]>(initialOrder);
  const [sortKey, setSortKey] = useState<StatKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const orderRef = useRef(order);
  orderRef.current = order;
  const tableRef = useRef<HTMLDivElement>(null);

  const supabase = useMemo(() => createClient(), []);
  const { state, trigger } = useAutoSave(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const { error } = await supabase.from("redrafts").upsert(
      {
        user_id: user.id,
        draft_year: year,
        ordered_player_ids: orderRef.current,
      },
      { onConflict: "user_id,draft_year" },
    );
    if (error) throw error;
  });

  // What's actually shown: sorted by stat (a transient lens) or the manual order.
  const displayIds = useMemo(
    () =>
      sortKey ? sortPlayerIds(players, order, sortKey, sortDir) : order,
    [players, order, sortKey, sortDir],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = displayIds.indexOf(String(active.id));
    const to = displayIds.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    // Dragging takes over: bake the current (possibly sorted) view into the
    // manual order, then apply the move.
    const next = arrayMove(displayIds, from, to);
    setSortKey(null);
    setOrder(next);
    orderRef.current = next;
    trigger();
  }

  function handleSort(key: StatKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function resetToActual() {
    setSortKey(null);
    setOrder(actualOrder);
    orderRef.current = actualOrder;
    trigger();
  }

  function handleCsv() {
    const headers = [
      "Slot",
      "Player",
      "ActualPick",
      "Delta",
      "College",
      "Team",
      ...REDRAFT_STAT_COLUMNS.map((c) => c.label),
    ];
    const rows = displayIds.map((id, i) => {
      const p = byId.get(id)!;
      const slot = i + 1;
      return [
        slot,
        p.name,
        p.overallPick,
        pickDelta(p.overallPick, slot),
        p.college ?? "",
        p.team ?? "",
        ...REDRAFT_STAT_COLUMNS.map((c) => {
          const v = p.stats[c.key as keyof Player["stats"]] as number | null;
          return v ?? "";
        }),
      ];
    });
    exportCsv(`redraft-${year}.csv`, headers, rows);
  }

  async function handlePng() {
    if (tableRef.current) {
      await exportPng(tableRef.current, `redraft-${year}.png`);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            {year} Redraft
          </h2>
          <SaveIndicator state={state} />
          {sortKey && (
            <span className="text-ink-faint font-mono text-xs">
              viewing by {sortKey.toUpperCase()} — drag a row to lock it in
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ToolButton onClick={resetToActual}>Reset to actual order</ToolButton>
          <ToolButton onClick={handleCsv}>Export CSV</ToolButton>
          <ToolButton onClick={handlePng}>Export PNG</ToolButton>
        </div>
      </div>

      <div
        ref={tableRef}
        className="border-border bg-surface overflow-x-auto rounded-xl border"
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-border bg-surface-2/60 text-ink-faint border-b text-left">
              <th className="w-8" />
              <th className="w-10 px-2 py-2 text-right font-mono text-[11px] uppercase">
                #
              </th>
              <th className="w-12" />
              <th className="px-2 py-2 font-mono text-[11px] uppercase">
                Player
              </th>
              {REDRAFT_STAT_COLUMNS.map((col) => (
                <StatHeader
                  key={col.key}
                  label={col.label}
                  active={sortKey === col.key}
                  dir={sortDir}
                  onClick={() => handleSort(col.key)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayIds}
                strategy={verticalListSortingStrategy}
              >
                {displayIds.map((id, i) => {
                  const p = byId.get(id);
                  if (!p) return null;
                  return <RedraftRow key={id} player={p} slot={i + 1} />;
                })}
              </SortableContext>
            </DndContext>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToolButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="border-border text-ink-muted hover:border-border-strong hover:text-ink rounded-md border px-2.5 py-1.5 font-mono text-xs transition-colors"
    >
      {children}
    </button>
  );
}
