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
  ChevronDown,
  ChevronUp,
  ImageDown,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  X,
} from "lucide-react";
import { RedraftRow } from "./RedraftRow";
import { PlayerDrawer } from "./PlayerDrawer";
import { TeamLogo } from "./TeamLogo";
import { SaveIndicator } from "@/components/SaveIndicator";
import { Headshot } from "@/components/Headshot";
import { useAutoSave } from "@/hooks/useAutoSave";
import { createClient } from "@/lib/supabase/client";
import { sortPlayerIds, type SortDir } from "@/lib/sort";
import { buildHeat } from "@/lib/heat";
import { teamColor } from "@/lib/teamColors";
import { DRAFT_ORDER, type OriginalPick } from "@/lib/draftOrder";
import {
  CUTS_ENABLED,
  REDRAFT_STAT_COLUMNS,
  type StatKey,
} from "@/lib/constants";
import { exportPng } from "@/lib/export";
import type { Player } from "@/lib/types";

export function RedraftTable({
  year,
  players,
  initialOrder,
  initialCuts = [],
}: {
  year: number;
  players: Player[];
  initialOrder: string[];
  initialCuts?: string[];
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
  const heat = useMemo(
    () =>
      buildHeat(
        players,
        REDRAFT_STAT_COLUMNS.map((c) => c.key),
      ),
    [players],
  );

  // Reconcile the saved order with the current player pool: drop ids that no
  // longer exist (trimmed players) and append newly ingested ones at the
  // bottom in actual-pick order. Cut players sit in a separate pile.
  const [cuts, setCuts] = useState<string[]>(() =>
    initialCuts.filter((id) => byId.has(id)),
  );
  const [order, setOrder] = useState<string[]>(() => {
    const cutSet = new Set(initialCuts);
    const kept = initialOrder.filter((id) => byId.has(id) && !cutSet.has(id));
    const seen = new Set(kept);
    const added = actualOrder.filter(
      (id) => !seen.has(id) && !cutSet.has(id),
    );
    return [...kept, ...added];
  });

  // Draft night at each slot — owning franchise + who they actually took —
  // from the generated map (independent of which players survive the trim).
  const slotInfo = (slot: number): OriginalPick | null =>
    DRAFT_ORDER[year]?.[slot] ?? null;

  const [sortKey, setSortKey] = useState<StatKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState<Player | null>(null);
  // The original-pick part of the rail; slot + logo always stay. Closed by
  // default — the labeled toggle opens it.
  const [railOpen, setRailOpen] = useState(false);

  const orderRef = useRef(order);
  orderRef.current = order;
  const cutsRef = useRef(cuts);
  cutsRef.current = cuts;
  const historyRef = useRef<{ order: string[]; cuts: string[] }[]>([]);
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
        cut_player_ids: cutsRef.current,
      },
      { onConflict: "user_id,draft_year" },
    );
    if (error) {
      toast.error("Save failed — check your connection.");
      throw error;
    }
  });

  // What's shown: the manual order, optionally through a stat lens, then the
  // search filter. Dragging is only enabled on the unfiltered view.
  const displayIds = useMemo(
    () => (sortKey ? sortPlayerIds(players, order, sortKey, sortDir) : order),
    [players, order, sortKey, sortDir],
  );
  const searching = search.trim().length > 0;
  const visibleIds = useMemo(() => {
    if (!searching) return displayIds;
    const q = search.trim().toLowerCase();
    return displayIds.filter((id) => {
      const p = byId.get(id);
      if (!p) return false;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.college?.toLowerCase().includes(q) ?? false) ||
        (p.team?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [displayIds, byId, search, searching]);
  const draggable = !searching;

  const slotOf = useMemo(() => {
    const m = new Map<string, number>();
    displayIds.forEach((id, i) => m.set(id, i + 1));
    return m;
  }, [displayIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /** Commit a new order (and optionally cut pile): undo history, persist, toast. */
  function commit(next: string[], message?: string, nextCuts?: string[]) {
    historyRef.current.push({
      order: orderRef.current,
      cuts: cutsRef.current,
    });
    if (historyRef.current.length > 50) historyRef.current.shift();
    setSortKey(null);
    setOrder(next);
    orderRef.current = next;
    if (nextCuts) {
      setCuts(nextCuts);
      cutsRef.current = nextCuts;
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
    setCuts(prev.cuts);
    orderRef.current = prev.order;
    cutsRef.current = prev.cuts;
    trigger();
  }

  function cutPlayer(id: string) {
    const p = byId.get(id);
    commit(
      order.filter((x) => x !== id),
      p ? `${p.name} cut from board` : undefined,
      [...cuts, id],
    );
  }

  function restorePlayer(id: string) {
    const p = byId.get(id);
    commit(
      [...order, id],
      p ? `${p.name} back at #${order.length + 1}` : undefined,
      cuts.filter((x) => x !== id),
    );
  }

  function keepTop(n: number) {
    if (displayIds.length <= n) return;
    const dropped = displayIds.slice(n);
    commit(
      displayIds.slice(0, n),
      `Cut ${dropped.length} players — first round only`,
      [...cuts, ...dropped],
    );
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
    const from = displayIds.indexOf(String(active.id));
    const to = displayIds.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    // Dragging takes over: bake the current (possibly sorted) view into the
    // manual order, then apply the move.
    const p = byId.get(String(active.id));
    commit(
      arrayMove(displayIds, from, to),
      p ? `${p.name} → #${to + 1}` : undefined,
    );
  }

  function handleDragCancel() {
    setActiveId(null);
    document.body.classList.remove("dragging-active");
  }

  function moveTo(id: string, slot: number) {
    const from = displayIds.indexOf(id);
    if (from < 0) return;
    const p = byId.get(id);
    commit(
      arrayMove(displayIds, from, slot - 1),
      p ? `${p.name} → #${slot}` : undefined,
    );
  }

  function handleSort(key: StatKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function applySortAsOrder() {
    if (!sortKey) return;
    commit([...displayIds], `Order set by ${sortKey.toUpperCase()}`);
  }

  function resetToActual() {
    commit(actualOrder, "Reset to actual draft order", []);
  }

  async function handlePng() {
    if (!tableRef.current) return;
    const id = toast.loading("Building image…");
    try {
      await exportPng(tableRef.current, `redraft-${year}.png`, {
        title: `${year} Redraft`,
        subtitle: "Your board vs. the actual draft",
      });
      toast.success("Image ready", { id });
    } catch {
      toast.error("Couldn’t build the image — try again.", { id });
    }
  }

  const activePlayer = activeId ? byId.get(activeId) : null;

  return (
    <div className="space-y-4">
      {/* title + actions */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-4">
          <h2 className="display text-4xl font-bold leading-none">
            <span className="text-accent">{year}</span> Redraft
          </h2>
          <SaveIndicator state={state} />
        </div>
        <div className="flex items-center gap-2">
          {CUTS_ENABLED && displayIds.length > 30 && (
            <ToolButton
              onClick={() => keepTop(30)}
              icon={<Scissors className="h-3.5 w-3.5" />}
            >
              Top 30 only
            </ToolButton>
          )}
          <ToolButton onClick={resetToActual} icon={<RotateCcw className="h-3.5 w-3.5" />}>
            Reset
          </ToolButton>
          <ToolButton onClick={handlePng} icon={<ImageDown className="h-3.5 w-3.5" />}>
            PNG
          </ToolButton>
        </div>
      </div>

      {/* search + mode banners */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="text-ink-faint pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player, college, team…"
            className="bg-surface-2 border-border focus:border-accent w-72 rounded-lg border py-2 pl-8 pr-8 text-sm outline-none transition-colors"
          />
          {searching && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="text-ink-faint hover:text-ink absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {searching && (
          <span className="text-ink-faint font-mono text-xs">
            {visibleIds.length} match{visibleIds.length === 1 ? "" : "es"} —
            clear to reorder
          </span>
        )}
        {sortKey && !searching && (
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

      {/* board: static slot/logo rail + sortable player rows */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          className="border-border bg-surface overflow-auto rounded-xl border"
          style={{ maxHeight: "calc(100vh - 230px)", minHeight: 360 }}
        >
          <div
            ref={tableRef}
            className={railOpen ? "min-w-[1190px]" : "min-w-[1000px]"}
          >
            {/* header strip */}
            <div className="bg-surface-2 sticky top-0 z-20 flex shadow-[inset_0_-1px_0_0_var(--color-border)]">
              <div
                className={`bg-surface-2 border-border/70 sticky left-0 z-10 flex shrink-0 items-center justify-between border-r pl-4 pr-2 ${railOpen ? "w-[362px]" : "w-[168px]"}`}
              >
                <span className="text-ink-faint font-mono text-[11px] uppercase">
                  Pick
                </span>
                <button
                  onClick={() => setRailOpen((v) => !v)}
                  aria-label={
                    railOpen ? "Hide original picks" : "Show original picks"
                  }
                  title={
                    railOpen
                      ? "Hide who was actually drafted at each slot"
                      : "Show who was actually drafted at each slot"
                  }
                  className={[
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide transition-colors duration-150",
                    railOpen
                      ? "border-border text-ink-muted hover:text-ink"
                      : "border-accent/40 text-accent hover:bg-accent/10",
                  ].join(" ")}
                >
                  {railOpen ? (
                    <>
                      <PanelLeftClose className="h-3.5 w-3.5" />
                      Hide OG picks
                    </>
                  ) : (
                    <>
                      <PanelLeftOpen className="h-3.5 w-3.5" />
                      OG picks
                    </>
                  )}
                </button>
              </div>
              <div className="flex flex-1 items-center py-2">
                <span className="w-8" />
                <span className="text-ink-faint flex-1 pl-[86px] font-mono text-[11px] uppercase">
                  Your redraft
                </span>
                <span className="flex items-center">
                  {REDRAFT_STAT_COLUMNS.map((col) => (
                    <span
                      key={col.key}
                      className={`w-16 justify-end px-1 text-right ${col.cellClass ?? "inline-flex"}`}
                    >
                      <button
                        onClick={() => handleSort(col.key)}
                        aria-label={`Sort by ${col.label}`}
                        className={[
                          "hover:text-ink inline-flex cursor-pointer items-center font-mono text-[11px] uppercase tracking-wide transition-colors",
                          sortKey === col.key
                            ? "text-accent"
                            : "text-ink-faint",
                        ].join(" ")}
                      >
                        {col.label}
                        {sortKey === col.key &&
                          (sortDir === "desc" ? (
                            <ChevronDown className="h-3 w-3" strokeWidth={3} />
                          ) : (
                            <ChevronUp className="h-3 w-3" strokeWidth={3} />
                          ))}
                      </button>
                    </span>
                  ))}
                </span>
                <span className="w-9" />
              </div>
            </div>

            {/* body */}
            <div className="flex">
              {/* static draft-night rail — never part of the drag */}
              <div
                className={`bg-surface border-border/70 sticky left-0 z-10 shrink-0 border-r ${railOpen ? "w-[362px]" : "w-[168px]"}`}
              >
                {visibleIds.map((id) => {
                  const slot = slotOf.get(id) ?? 0;
                  const info = slotInfo(slot);
                  return (
                    <div
                      key={`rail-${id}`}
                      className="border-border/70 flex h-[88px] items-center gap-3 border-b pl-3 pr-2"
                    >
                      <span
                        className={[
                          "display w-9 shrink-0 text-right text-3xl font-bold leading-none",
                          slot <= 14 ? "text-accent" : "text-ink-muted",
                        ].join(" ")}
                      >
                        {slot}
                      </span>
                      <TeamLogo team={info?.team} size={80} />
                      {railOpen &&
                        (info ? (
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <Headshot
                              src={
                                info.personId
                                  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/headshots/players/${info.personId}.png`
                                  : null
                              }
                              alt={info.player}
                              size={40}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-ink-muted truncate text-[13px] font-semibold leading-tight">
                                {info.player}
                              </div>
                              <div className="text-ink-faint font-mono text-[9px] uppercase tracking-wide">
                                Actual pick
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-ink-faint text-[11px]">—</span>
                        ))}
                    </div>
                  );
                })}
              </div>

              {/* sortable player rows */}
              <div className="min-w-0 flex-1">
                <SortableContext
                  items={visibleIds}
                  strategy={verticalListSortingStrategy}
                >
                  {visibleIds.map((id) => {
                    const p = byId.get(id);
                    if (!p) return null;
                    return (
                      <RedraftRow
                        key={id}
                        player={p}
                        slot={slotOf.get(id) ?? 0}
                        total={displayIds.length}
                        draggable={draggable}
                        heat={heat}
                        onOpen={() => setOpen(p)}
                        onMoveTo={(s) => moveTo(id, s)}
                        onCut={() => cutPlayer(id)}
                      />
                    );
                  })}
                </SortableContext>
              </div>
            </div>
          </div>
        </div>

        <DragOverlay>
          {activePlayer && (
            <div
              className="bg-surface-3 border-border-strong flex items-center gap-3 rounded-xl border px-4 py-2"
              style={{
                boxShadow: `0 16px 48px rgba(0,0,0,.6), inset 3px 0 0 0 ${teamColor(activePlayer.team)}`,
              }}
            >
              <Headshot
                src={activePlayer.headshotUrl}
                alt={activePlayer.name}
                size={52}
                accent={teamColor(activePlayer.team)}
              />
              <span className="display text-ink text-xl font-bold">
                {activePlayer.name}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* cut pile */}
      {CUTS_ENABLED && cuts.length > 0 && (
        <div className="border-border bg-surface/50 rounded-xl border p-4">
          <div className="display text-ink-muted mb-3 text-sm font-semibold tracking-wide">
            Cut from board ({cuts.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {cuts.map((id) => {
              const p = byId.get(id);
              if (!p) return null;
              return (
                <button
                  key={id}
                  onClick={() => restorePlayer(id)}
                  title={`Add ${p.name} back to the board`}
                  className="border-border hover:border-accent bg-surface-2 flex cursor-pointer items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm transition-colors duration-150"
                >
                  <Headshot
                    src={p.headshotUrl}
                    alt={p.name}
                    size={28}
                    accent={teamColor(p.team)}
                  />
                  <span className="text-ink-muted">{p.name}</span>
                  <Plus className="text-accent h-3.5 w-3.5" strokeWidth={3} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <PlayerDrawer
        player={open}
        slot={open ? (slotOf.get(open.id) ?? null) : null}
        onClose={() => setOpen(null)}
      />
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
