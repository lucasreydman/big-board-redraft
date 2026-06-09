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
import { ProspectRow } from "./ProspectRow";
import { TierDivider } from "./TierDivider";
import { SaveIndicator } from "@/components/SaveIndicator";
import { StatHeader } from "@/components/StatHeader";
import { Headshot } from "@/components/Headshot";
import { useAutoSave } from "@/hooks/useAutoSave";
import { createClient } from "@/lib/supabase/client";
import { sortProspectIds, type SortDir } from "@/lib/sort";
import {
  PROSPECT_STAT_COLUMNS,
  POSITIONS,
  type ProspectStatKey,
} from "@/lib/constants";
import { exportCsv, exportPng } from "@/lib/export";
import type { BigBoard, Prospect, Tier } from "@/lib/types";

export function BigBoardClient({
  prospects,
  initialBoard,
}: {
  prospects: Prospect[];
  initialBoard: BigBoard | null;
}) {
  const byId = useMemo(
    () => new Map(prospects.map((p) => [p.id, p])),
    [prospects],
  );
  const allIds = useMemo(() => prospects.map((p) => p.id), [prospects]);

  const [boardId, setBoardId] = useState<string | null>(
    initialBoard?.id ?? null,
  );
  const [name, setName] = useState(initialBoard?.name ?? "My 2026 Big Board");
  const [order, setOrder] = useState<string[]>(
    initialBoard?.orderedProspectIds?.length
      ? initialBoard.orderedProspectIds.filter((id) => byId.has(id))
      : allIds,
  );
  const [tiers, setTiers] = useState<Tier[]>(initialBoard?.tiers ?? []);
  const [notes, setNotes] = useState<Record<string, string>>(
    initialBoard?.notes ?? {},
  );

  const [sortKey, setSortKey] = useState<ProspectStatKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<string>("");
  const [openNotes, setOpenNotes] = useState<string | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);

  // Keep refs fresh so the debounced saver always persists current state.
  const stateRef = useRef({ order, tiers, notes, name });
  stateRef.current = { order, tiers, notes, name };

  const supabase = useMemo(() => createClient(), []);
  const { state, trigger } = useAutoSave(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const cur = stateRef.current;
    const payload = {
      user_id: user.id,
      name: cur.name,
      ordered_prospect_ids: cur.order,
      tiers: cur.tiers,
      notes: cur.notes,
    };
    if (boardId) {
      const { error } = await supabase
        .from("big_boards")
        .update(payload)
        .eq("id", boardId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("big_boards")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      if (data) setBoardId(data.id);
    }
  });

  const filterActive = search.trim().length > 0 || posFilter.length > 0;
  const onBoard = useMemo(() => new Set(order), [order]);

  function matchesFilter(p: Prospect): boolean {
    if (posFilter && p.position !== posFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.school?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  }

  // The board order, optionally viewed through a stat lens, then filtered.
  const lensOrder = sortKey
    ? sortProspectIds(prospects, order, sortKey, sortDir)
    : order;
  const visibleIds = filterActive
    ? lensOrder.filter((id) => {
        const p = byId.get(id);
        return p ? matchesFilter(p) : false;
      })
    : lensOrder;

  // Prospects not on the board (for the add panel).
  const available = prospects.filter(
    (p) => !onBoard.has(p.id) && matchesFilter(p),
  );

  const rankOf = (id: string) => order.indexOf(id) + 1;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = lensOrder.indexOf(String(active.id));
    const to = lensOrder.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(lensOrder, from, to);
    setSortKey(null);
    setOrder(next);
    stateRef.current.order = next;
    trigger();
  }

  function handleSort(key: ProspectStatKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function insertTierAt(index: number) {
    if (tiers.some((t) => t.position === index)) return;
    const next = [...tiers, { position: index, label: "New Tier" }].sort(
      (a, b) => a.position - b.position,
    );
    setTiers(next);
    stateRef.current.tiers = next;
    trigger();
  }

  function labelTier(position: number, label: string) {
    const next = tiers.map((t) => (t.position === position ? { ...t, label } : t));
    setTiers(next);
    stateRef.current.tiers = next;
    trigger();
  }

  function removeTier(position: number) {
    const next = tiers.filter((t) => t.position !== position);
    setTiers(next);
    stateRef.current.tiers = next;
    trigger();
  }

  function setNote(id: string, v: string) {
    const next = { ...notes, [id]: v };
    if (!v) delete next[id];
    setNotes(next);
    stateRef.current.notes = next;
    trigger();
  }

  function addToBoard(id: string) {
    const next = [...order, id];
    setOrder(next);
    stateRef.current.order = next;
    trigger();
  }

  function removeFromBoard(id: string) {
    const idx = order.indexOf(id);
    if (idx < 0) return;
    const next = order.filter((x) => x !== id);
    // Tiers are fixed slots; shift those past the removed index down by one.
    const nextTiers = tiers
      .map((t) => (t.position > idx ? { ...t, position: t.position - 1 } : t))
      .filter((t) => t.position <= next.length);
    const nextNotes = { ...notes };
    delete nextNotes[id];
    setOrder(next);
    setTiers(nextTiers);
    setNotes(nextNotes);
    stateRef.current = { ...stateRef.current, order: next, tiers: nextTiers, notes: nextNotes };
    trigger();
  }

  function renameBoard(v: string) {
    setName(v);
    stateRef.current.name = v;
    trigger();
  }

  // ---- exports ----
  function tierLabelForIndex(i: number): string {
    let label = "";
    for (const t of tiers) if (t.position <= i) label = t.label;
    return label;
  }

  function handleCsv() {
    const headers = [
      "Rank",
      "Tier",
      "Player",
      "School",
      "Pos",
      "Class",
      "Height",
      "Weight",
      "Age",
      "PPG",
      "RPG",
      "APG",
      "FG%",
      "3P%",
      "FT%",
      "ProjectedRange",
      "Notes",
    ];
    const rows = order.map((id, i) => {
      const p = byId.get(id)!;
      return [
        i + 1,
        tierLabelForIndex(i),
        p.name,
        p.school ?? "",
        p.position ?? "",
        p.classYear ?? "",
        p.height ?? "",
        p.weight ?? "",
        p.age ?? "",
        p.ppg ?? "",
        p.rpg ?? "",
        p.apg ?? "",
        p.fgPct ?? "",
        p.fg3Pct ?? "",
        p.ftPct ?? "",
        p.projectedRange ?? "",
        notes[id] ?? "",
      ];
    });
    exportCsv("big-board-2026.csv", headers, rows);
  }

  async function handlePng() {
    if (boardRef.current) await exportPng(boardRef.current, "big-board-2026.png");
  }

  // ---- render the interleaved tiers + prospects ----
  const rows: React.ReactNode[] = [];
  visibleIds.forEach((id, displayIdx) => {
    const p = byId.get(id);
    if (!p) return;
    const fullIdx = order.indexOf(id);
    if (!filterActive) {
      tiers
        .filter((t) => t.position === displayIdx)
        .forEach((t) => (
          rows.push(
            <TierDivider
              key={`tier-${t.position}`}
              label={t.label}
              onLabel={(v) => labelTier(t.position, v)}
              onRemove={() => removeTier(t.position)}
            />,
          )
        ));
    }
    rows.push(
      <ProspectRow
        key={id}
        prospect={p}
        rank={fullIdx + 1}
        note={notes[id] ?? ""}
        notesOpen={openNotes === id}
        draggable={!filterActive}
        onNoteChange={(v) => setNote(id, v)}
        onToggleNotes={() => setOpenNotes(openNotes === id ? null : id)}
        onInsertTierAbove={
          filterActive ? null : () => insertTierAt(fullIdx)
        }
        onRemove={() => removeFromBoard(id)}
      />,
    );
  });
  if (!filterActive) {
    tiers
      .filter((t) => t.position >= visibleIds.length)
      .forEach((t) =>
        rows.push(
          <TierDivider
            key={`tier-${t.position}`}
            label={t.label}
            onLabel={(v) => labelTier(t.position, v)}
            onRemove={() => removeTier(t.position)}
          />,
        ),
      );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <input
            value={name}
            onChange={(e) => renameBoard(e.target.value)}
            className="text-ink focus:border-accent border-b border-transparent bg-transparent text-lg font-semibold tracking-tight outline-none"
          />
          <SaveIndicator state={state} />
        </div>
        <div className="flex items-center gap-2">
          <ToolButton onClick={() => insertTierAt(0)}>＋ Tier (top)</ToolButton>
          <ToolButton onClick={handleCsv}>Export CSV</ToolButton>
          <ToolButton onClick={handlePng}>Export PNG</ToolButton>
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or school…"
          className="bg-surface-2 border-border focus:border-accent w-56 rounded-md border px-3 py-1.5 text-sm outline-none"
        />
        <select
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value)}
          className="bg-surface-2 border-border focus:border-accent rounded-md border px-2 py-1.5 font-mono text-xs outline-none"
        >
          <option value="">All positions</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {filterActive && (
          <span className="text-ink-faint font-mono text-xs">
            filtered view — clear to reorder
          </span>
        )}
        {sortKey && !filterActive && (
          <span className="text-ink-faint font-mono text-xs">
            viewing by {sortKey.toUpperCase()} — drag to lock it in
          </span>
        )}
      </div>

      {/* column header strip */}
      <div className="text-ink-faint flex items-center gap-2 px-3">
        <span className="w-5" />
        <span className="w-7 text-right font-mono text-[11px] uppercase">#</span>
        <span className="w-9" />
        <span className="flex-1 font-mono text-[11px] uppercase">Prospect</span>
        <div className="flex items-center">
          {PROSPECT_STAT_COLUMNS.map((col) => (
            <span key={col.key} className="w-14 text-right">
              <StatHeader
                label={col.label}
                active={sortKey === col.key}
                dir={sortDir}
                onClick={() => handleSort(col.key)}
              />
            </span>
          ))}
        </div>
        <span className="w-24" />
      </div>

      <div
        ref={boardRef}
        className="border-border bg-surface overflow-hidden rounded-xl border"
      >
        {visibleIds.length === 0 ? (
          <div className="text-ink-muted p-8 text-center text-sm">
            No prospects on the board match this view.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleIds}
              strategy={verticalListSortingStrategy}
            >
              {rows}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* available prospects (not on board) */}
      {available.length > 0 && (
        <div className="border-border bg-surface/50 rounded-xl border p-3">
          <div className="text-ink-faint mb-2 font-mono text-[11px] uppercase tracking-wide">
            Not on board ({available.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {available.map((p) => (
              <button
                key={p.id}
                onClick={() => addToBoard(p.id)}
                className="border-border hover:border-accent bg-surface-2 flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors"
              >
                <Headshot src={p.headshotUrl} alt={p.name} size={22} />
                <span className="text-ink-muted">{p.name}</span>
                <span className="text-accent font-mono text-xs">＋</span>
              </button>
            ))}
          </div>
        </div>
      )}
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
