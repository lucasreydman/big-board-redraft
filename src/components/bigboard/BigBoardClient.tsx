"use client";

import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { toast } from "sonner";
import {
  Check,
  Download,
  ImageDown,
  ListPlus,
  Plus,
  Search,
  X,
} from "lucide-react";
import { ProspectRow } from "./ProspectRow";
import { TierDivider, RoundDivider } from "./TierDivider";
import { SaveIndicator } from "@/components/SaveIndicator";
import { Headshot } from "@/components/Headshot";
import { useAutoSave } from "@/hooks/useAutoSave";
import { createClient } from "@/lib/supabase/client";
import { sortProspectIds, type SortDir } from "@/lib/sort";
import { pickOwner2026 } from "@/lib/pickOwners2026";
import { buildProspectHeat } from "@/lib/heat";
import { positionColor } from "@/lib/teamColors";
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
  // A fresh board starts in consensus order (parsed from projected_range,
  // e.g. "#13" or "#10-20"), not whatever order the rows came back in.
  const allIds = useMemo(() => {
    const rank = (p: Prospect) => {
      const m = p.projectedRange?.match(/\d+/);
      return m ? parseInt(m[0], 10) : Number.POSITIVE_INFINITY;
    };
    return [...prospects]
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
      .map((p) => p.id);
  }, [prospects]);
  const heat = useMemo(
    () =>
      buildProspectHeat(
        prospects,
        PROSPECT_STAT_COLUMNS.map((c) => c.key),
      ),
    [prospects],
  );

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
  const [activeId, setActiveId] = useState<string | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<{ order: string[]; tiers: Tier[] }[]>([]);

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
      if (error) {
        toast.error("Save failed — check your connection.");
        throw error;
      }
    } else {
      const { data, error } = await supabase
        .from("big_boards")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        toast.error("Save failed — check your connection.");
        throw error;
      }
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /** Commit an order/tier change: history for undo, persist, toast. */
  function commit(
    next: { order?: string[]; tiers?: Tier[] },
    message?: string,
  ) {
    historyRef.current.push({
      order: stateRef.current.order,
      tiers: stateRef.current.tiers,
    });
    if (historyRef.current.length > 50) historyRef.current.shift();
    if (next.order) {
      setOrder(next.order);
      stateRef.current.order = next.order;
    }
    if (next.tiers) {
      setTiers(next.tiers);
      stateRef.current.tiers = next.tiers;
    }
    trigger();
    if (message) {
      toast(message, {
        action: { label: "Undo", onClick: undo },
        duration: 4000,
      });
    }
  }

  function undo() {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setSortKey(null);
    setOrder(prev.order);
    setTiers(prev.tiers);
    stateRef.current.order = prev.order;
    stateRef.current.tiers = prev.tiers;
    trigger();
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    document.body.classList.add("dragging-active");
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    document.body.classList.remove("dragging-active");
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = lensOrder.indexOf(String(active.id));
    const to = lensOrder.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const p = byId.get(String(active.id));
    setSortKey(null);
    commit(
      { order: arrayMove(lensOrder, from, to) },
      p ? `${p.name} → #${to + 1}` : undefined,
    );
  }

  function handleDragCancel() {
    setActiveId(null);
    document.body.classList.remove("dragging-active");
  }

  function handleSort(key: ProspectStatKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function applySortAsOrder() {
    if (!sortKey) return;
    const next = [...lensOrder];
    setSortKey(null);
    commit({ order: next }, `Order set by ${sortKey.toUpperCase()}`);
  }

  function insertTierAt(index: number) {
    if (tiers.some((t) => t.position === index)) return;
    const next = [...tiers, { position: index, label: "New Tier" }].sort(
      (a, b) => a.position - b.position,
    );
    commit({ tiers: next });
  }

  function labelTier(position: number, label: string) {
    const next = tiers.map((t) =>
      t.position === position ? { ...t, label } : t,
    );
    setTiers(next);
    stateRef.current.tiers = next;
    trigger();
  }

  function removeTier(position: number) {
    commit({ tiers: tiers.filter((t) => t.position !== position) });
  }

  function setNote(id: string, v: string) {
    const next = { ...notes, [id]: v };
    if (!v) delete next[id];
    setNotes(next);
    stateRef.current.notes = next;
    trigger();
  }

  function addToBoard(id: string) {
    const p = byId.get(id);
    commit(
      { order: [...order, id] },
      p ? `${p.name} added at #${order.length + 1}` : undefined,
    );
  }

  function removeFromBoard(id: string) {
    const idx = order.indexOf(id);
    if (idx < 0) return;
    const p = byId.get(id);
    const nextOrder = order.filter((x) => x !== id);
    // Tiers are fixed slots; shift those past the removed index down by one.
    const nextTiers = tiers
      .map((t) => (t.position > idx ? { ...t, position: t.position - 1 } : t))
      .filter((t) => t.position <= nextOrder.length);
    const nextNotes = { ...notes };
    delete nextNotes[id];
    setNotes(nextNotes);
    stateRef.current.notes = nextNotes;
    commit(
      { order: nextOrder, tiers: nextTiers },
      p ? `${p.name} removed from board` : undefined,
    );
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
    if (boardRef.current)
      await exportPng(boardRef.current, "big-board-2026.png");
  }

  // ---- render the interleaved tiers + prospects ----
  const rows: React.ReactNode[] = [];
  visibleIds.forEach((id, displayIdx) => {
    const p = byId.get(id);
    if (!p) return;
    const fullIdx = order.indexOf(id);
    // Fixed round break — structural, not a user tier, so it never moves.
    if (!filterActive && displayIdx === 30) {
      rows.push(<RoundDivider key="round-2" label="Round 2" />);
    }
    if (!filterActive) {
      tiers
        .filter((t) => t.position === displayIdx)
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
    rows.push(
      <ProspectRow
        key={id}
        prospect={p}
        rank={fullIdx + 1}
        slotTeam={pickOwner2026(fullIdx + 1)}
        note={notes[id] ?? ""}
        notesOpen={openNotes === id}
        draggable={!filterActive}
        heat={heat}
        onNoteChange={(v) => setNote(id, v)}
        onToggleNotes={() => setOpenNotes(openNotes === id ? null : id)}
        onInsertTierAbove={filterActive ? null : () => insertTierAt(fullIdx)}
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

  const activeProspect = activeId ? byId.get(activeId) : null;

  return (
    <div className="space-y-4">
      {/* title + actions */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-4">
          <input
            value={name}
            onChange={(e) => renameBoard(e.target.value)}
            aria-label="Board name"
            className="display text-ink focus:border-accent w-[22ch] border-b-2 border-transparent bg-transparent text-3xl font-bold leading-none outline-none transition-colors"
          />
          <SaveIndicator state={state} />
        </div>
        <div className="flex items-center gap-2">
          <ToolButton
            onClick={() => insertTierAt(0)}
            icon={<ListPlus className="h-3.5 w-3.5" />}
          >
            Tier
          </ToolButton>
          <ToolButton
            onClick={handleCsv}
            icon={<Download className="h-3.5 w-3.5" />}
          >
            CSV
          </ToolButton>
          <ToolButton
            onClick={handlePng}
            icon={<ImageDown className="h-3.5 w-3.5" />}
          >
            PNG
          </ToolButton>
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="text-ink-faint pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or school…"
            className="bg-surface-2 border-border focus:border-accent w-64 rounded-lg border py-2 pl-8 pr-8 text-sm outline-none transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="text-ink-faint hover:text-ink absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value)}
          className="bg-surface-2 border-border focus:border-accent cursor-pointer rounded-lg border px-3 py-2 font-mono text-xs uppercase outline-none transition-colors"
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
          <span className="border-accent/30 bg-accent/5 text-accent flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-xs uppercase">
            Viewing by {sortKey} {sortDir === "desc" ? "↓" : "↑"}
            <button
              onClick={applySortAsOrder}
              className="bg-accent text-base hover:bg-accent/90 inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 font-semibold transition-colors"
            >
              <Check className="h-3 w-3" strokeWidth={3} /> Apply as my order
            </button>
            <button
              onClick={() => setSortKey(null)}
              aria-label="Clear sort"
              className="hover:text-ink cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>

      {/* board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          ref={boardRef}
          className="border-border bg-surface overflow-auto rounded-xl border"
          style={{ maxHeight: "calc(100vh - 230px)", minHeight: 360 }}
        >
          <div className="min-w-[1000px]">
            {/* header strip */}
            <div className="bg-surface-2 text-ink-faint sticky top-0 z-20 flex items-center gap-2 px-2 py-2 shadow-[inset_0_-1px_0_0_var(--color-border)]">
              <span className="w-11 text-right font-mono text-[11px] uppercase">
                Rank
              </span>
              <span className="w-20 text-center font-mono text-[11px] uppercase">
                Pick
              </span>
              <span className="w-8" />
              <span className="w-[76px]" />
              <span className="flex-1 font-mono text-[11px] uppercase">
                Prospect
              </span>
              <div className="flex items-center">
                {PROSPECT_STAT_COLUMNS.map((col) => (
                  <span
                    key={col.key}
                    className={`w-16 justify-end text-right ${col.cellClass ?? "inline-flex"}`}
                  >
                    <button
                      onClick={() => handleSort(col.key)}
                      aria-label={`Sort by ${col.label}`}
                      className={[
                        "hover:text-ink inline-flex cursor-pointer items-center font-mono text-[11px] uppercase tracking-wide transition-colors",
                        sortKey === col.key ? "text-accent" : "text-ink-faint",
                      ].join(" ")}
                    >
                      {col.label}
                      {sortKey === col.key && (sortDir === "desc" ? " ↓" : " ↑")}
                    </button>
                  </span>
                ))}
              </div>
              <span className="w-24" />
            </div>

            {visibleIds.length === 0 ? (
              <div className="text-ink-muted p-10 text-center text-sm">
                No prospects on the board match this view.
              </div>
            ) : (
              <SortableContext
                items={visibleIds}
                strategy={verticalListSortingStrategy}
              >
                {rows}
              </SortableContext>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeProspect && (
            <div
              className="bg-surface-3 border-border-strong flex items-center gap-3 rounded-xl border px-4 py-2"
              style={{
                boxShadow: `0 16px 48px rgba(0,0,0,.6), inset 3px 0 0 0 ${positionColor(activeProspect.position)}`,
              }}
            >
              <Headshot
                src={activeProspect.headshotUrl}
                alt={activeProspect.name}
                size={52}
                accent={positionColor(activeProspect.position)}
              />
              <span className="display text-ink text-xl font-bold">
                {activeProspect.name}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* available prospects (not on board) */}
      {available.length > 0 && (
        <div className="border-border bg-surface/50 rounded-xl border p-4">
          <div className="display text-ink-muted mb-3 text-sm font-semibold tracking-wide">
            Not on board ({available.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {available.map((p) => (
              <button
                key={p.id}
                onClick={() => addToBoard(p.id)}
                className="border-border hover:border-accent bg-surface-2 flex cursor-pointer items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm transition-colors duration-150"
              >
                <Headshot
                  src={p.headshotUrl}
                  alt={p.name}
                  size={28}
                  accent={positionColor(p.position)}
                />
                <span className="text-ink-muted">{p.name}</span>
                <Plus className="text-accent h-3.5 w-3.5" strokeWidth={3} />
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
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="border-border text-ink-muted hover:border-border-strong hover:text-ink inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-xs uppercase tracking-wide transition-colors duration-150"
    >
      {icon}
      {children}
    </button>
  );
}
