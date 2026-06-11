"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Pause,
  Play,
  Zap,
  RefreshCw,
  Trash2,
  ExternalLink,
  Plus,
} from "lucide-react";
import type { NewsDashboard } from "@/lib/agg/news";
import type { AggItem } from "@/lib/agg/types";
import {
  setPaused,
  setSurge,
  setThreshold,
  setPacing,
  setQuotaCap,
  addSource,
  toggleSource,
  removeSource,
  dropQueuedItem,
  runNow,
} from "./actions";

function rel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function NewsClient({
  dashboard,
  xConfigured,
  anthropicConfigured,
}: {
  dashboard: NewsDashboard;
  xConfigured: boolean;
  anthropicConfigured: boolean;
}) {
  const { config, quota, counts, surgeActive } = dashboard;
  const [pending, startTransition] = useTransition();

  function run<T>(fn: () => Promise<T>, ok: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const quotaPct = Math.min(
    100,
    Math.round((quota.postsUsed / Math.max(1, quota.cap)) * 100),
  );

  return (
    <div className="space-y-6">
      {/* Title + setup warnings */}
      <div>
        <div className="text-accent font-mono text-xs uppercase tracking-[0.3em]">
          TMN Aggregator
        </div>
        <h1 className="display text-ink mt-1 text-3xl font-bold">News feed</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Autonomous @TheModernNBA pipeline — scored, drafted, verified, and
          published on a managed schedule.
        </p>
      </div>

      {(!anthropicConfigured || !xConfigured) && (
        <div className="border-border bg-surface rounded-xl border p-4 text-sm">
          <p className="text-ink font-medium">Setup</p>
          <ul className="text-ink-muted mt-1 space-y-0.5">
            {!anthropicConfigured && (
              <li>
                · <code className="text-accent">ANTHROPIC_API_KEY</code> not set
                — scoring/drafting/verification will fail.
              </li>
            )}
            {!xConfigured && (
              <li>
                · X API keys not set — items are scored, drafted, verified and
                queued, but publishing is held until credentials exist.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Status strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Status">
          <span
            className={config.paused ? "text-down" : "text-up"}
          >
            {config.paused ? "Paused" : "Live"}
          </span>
        </Stat>
        <Stat label="Surge">
          <span className={surgeActive ? "text-accent" : "text-ink-muted"}>
            {surgeActive ? "On" : "Off"}
          </span>
        </Stat>
        <Stat label="Posted today">{dashboard.postedToday}</Stat>
        <Stat label={`Quota (${quota.month})`}>
          {quota.postsUsed}/{quota.cap}
          <div className="bg-surface-2 mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={`h-full ${quotaPct >= 95 ? "bg-down" : quotaPct >= 80 ? "bg-accent" : "bg-up"}`}
              style={{ width: `${quotaPct}%` }}
            />
          </div>
        </Stat>
      </div>

      {/* Pipeline status counts */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        {(
          [
            ["new", counts.new],
            ["scored", counts.scored],
            ["drafted", counts.drafted],
            ["queued", counts.queued],
            ["posted", counts.posted],
            ["rej-score", counts.rejected_score],
            ["rej-verify", counts.rejected_verify],
            ["failed", counts.failed],
            ["expired", counts.expired],
          ] as const
        ).map(([label, n]) => (
          <div
            key={label}
            className="border-border bg-surface rounded-lg border px-2.5 py-2 text-center"
          >
            <div className="text-ink text-lg font-semibold tabular-nums">{n}</div>
            <div className="text-ink-faint font-mono text-[10px] uppercase">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <Panel title="Controls">
        <div className="flex flex-wrap gap-2">
          <Action
            disabled={pending}
            onClick={() =>
              run(
                () => setPaused(!config.paused),
                config.paused ? "Resumed" : "Paused",
              )
            }
          >
            {config.paused ? (
              <>
                <Play className="h-3.5 w-3.5" /> Resume
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" /> Pause
              </>
            )}
          </Action>
          <Action
            disabled={pending}
            accent={surgeActive}
            onClick={() =>
              run(
                () => setSurge(!surgeActive),
                surgeActive ? "Surge off" : "Surge on (12h)",
              )
            }
          >
            <Zap className="h-3.5 w-3.5" /> {surgeActive ? "End surge" : "Surge"}
          </Action>
          <Action
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await runNow();
                return r;
              }, "Pipeline run complete")
            }
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`}
            />
            Run now
          </Action>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ThresholdControl
            value={config.score_threshold}
            disabled={pending}
            onSave={(v) => run(() => setThreshold(v), `Threshold → ${v}`)}
          />
          <QuotaControl
            value={config.quota_cap}
            disabled={pending}
            onSave={(v) => run(() => setQuotaCap(v), `Quota cap → ${v}`)}
          />
          <PacingControl
            gap={config.min_gap_minutes}
            perHour={config.max_per_hour}
            disabled={pending}
            onSave={(g, h) =>
              run(() => setPacing(g, h), `Pacing → ${g}m gap, ${h}/hr`)
            }
          />
        </div>
        {surgeActive && (
          <p className="text-ink-faint mt-3 text-xs">
            Surge active — threshold 6, 15m gap, 4/hr override the values above
            until it expires.
          </p>
        )}
      </Panel>

      {/* Queue */}
      <Panel title={`Queue (${dashboard.queued.length})`}>
        {dashboard.queued.length === 0 ? (
          <Empty>Nothing queued. The next run will fill it.</Empty>
        ) : (
          <ul className="space-y-2">
            {dashboard.queued.map((it) => (
              <li
                key={it.id}
                className="border-border bg-surface-2 rounded-lg border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <ScorePill score={it.score} />
                    <p className="text-ink mt-1.5 text-sm">{it.draft_text}</p>
                  </div>
                  <button
                    title="Drop from queue"
                    disabled={pending}
                    onClick={() =>
                      run(() => dropQueuedItem(it.id), "Dropped")
                    }
                    className="text-ink-faint hover:text-down shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Recent posts */}
      <Panel title="Recently posted">
        {dashboard.recentPosts.length === 0 ? (
          <Empty>No posts yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {dashboard.recentPosts.map((it) => (
              <FeedRow key={it.id} item={it} posted />
            ))}
          </ul>
        )}
      </Panel>

      {/* Recent rejects */}
      <Panel title="Recent rejections (tuning signal)">
        {dashboard.recentRejects.length === 0 ? (
          <Empty>No rejections.</Empty>
        ) : (
          <ul className="space-y-2">
            {dashboard.recentRejects.map((it) => (
              <FeedRow key={it.id} item={it} />
            ))}
          </ul>
        )}
      </Panel>

      {/* Sources */}
      <Panel title={`Sources (${dashboard.sources.length})`}>
        <ul className="space-y-1.5">
          {dashboard.sources.map((s) => (
            <li
              key={s.id}
              className="border-border bg-surface-2 flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-ink text-sm font-medium">{s.name}</span>
                  <span className="text-ink-faint font-mono text-[10px] uppercase">
                    {s.type}
                  </span>
                  {!s.is_active && (
                    <span className="text-down font-mono text-[10px] uppercase">
                      off{s.failure_count >= 10 ? " (failing)" : ""}
                    </span>
                  )}
                </div>
                <div className="text-ink-faint truncate font-mono text-[11px]">
                  {s.url}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => toggleSource(s.id, !s.is_active),
                      s.is_active ? "Deactivated" : "Activated",
                    )
                  }
                  className="text-ink-muted hover:text-ink border-border rounded-md border px-2 py-1 text-xs"
                >
                  {s.is_active ? "Disable" : "Enable"}
                </button>
                <button
                  title="Remove"
                  disabled={pending}
                  onClick={() => run(() => removeSource(s.id), "Removed")}
                  className="text-ink-faint hover:text-down"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <AddSourceForm />
      </Panel>
    </div>
  );
}

// --- Sub-components -------------------------------------------------------

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border bg-surface rounded-xl border p-4">
      <div className="text-ink-faint font-mono text-[10px] uppercase tracking-wide">
        {label}
      </div>
      <div className="text-ink mt-1 text-xl font-semibold">{children}</div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-surface rounded-xl border p-4">
      <h2 className="display text-ink mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-muted text-sm">{children}</p>;
}

function Action({
  children,
  onClick,
  disabled,
  accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
        accent
          ? "border-accent text-accent"
          : "border-border text-ink-muted hover:text-ink hover:border-border-strong",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ScorePill({ score }: { score: number | null }) {
  const n = score ?? 0;
  const tone = n >= 9 ? "text-up" : n >= 7.5 ? "text-accent" : "text-ink-muted";
  return (
    <span className={`font-mono text-xs font-semibold ${tone}`}>
      {score === null ? "—" : n.toFixed(1)}
    </span>
  );
}

function FeedRow({ item, posted }: { item: AggItem; posted?: boolean }) {
  return (
    <li className="border-border bg-surface-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScorePill score={item.score} />
          <span className="text-ink-faint text-xs">
            {rel(posted ? item.posted_at : item.created_at)}
          </span>
        </div>
        {posted && item.tweet_id && (
          <a
            href={`https://x.com/i/web/status/${item.tweet_id}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent inline-flex items-center gap-1 text-xs hover:underline"
          >
            View <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <p className="text-ink mt-1.5 text-sm">
        {item.draft_text ?? item.title}
      </p>
      {item.verify_reason && !posted && (
        <p className="text-down mt-1 text-xs">{item.verify_reason}</p>
      )}
    </li>
  );
}

function ThresholdControl({
  value,
  onSave,
  disabled,
}: {
  value: number;
  onSave: (v: number) => void;
  disabled?: boolean;
}) {
  const [v, setV] = useState(String(value));
  return (
    <Field label="Score threshold (1–10)">
      <input
        type="number"
        step="0.5"
        min={1}
        max={10}
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="input"
      />
      <SaveBtn disabled={disabled} onClick={() => onSave(Number(v))} />
    </Field>
  );
}

function QuotaControl({
  value,
  onSave,
  disabled,
}: {
  value: number;
  onSave: (v: number) => void;
  disabled?: boolean;
}) {
  const [v, setV] = useState(String(value));
  return (
    <Field label="Monthly quota cap (≤500)">
      <input
        type="number"
        min={0}
        max={500}
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="input"
      />
      <SaveBtn disabled={disabled} onClick={() => onSave(Number(v))} />
    </Field>
  );
}

function PacingControl({
  gap,
  perHour,
  onSave,
  disabled,
}: {
  gap: number;
  perHour: number;
  onSave: (gap: number, perHour: number) => void;
  disabled?: boolean;
}) {
  const [g, setG] = useState(String(gap));
  const [h, setH] = useState(String(perHour));
  return (
    <Field label="Pacing (min gap · max/hr)">
      <input
        type="number"
        min={0}
        value={g}
        onChange={(e) => setG(e.target.value)}
        className="input w-20"
      />
      <input
        type="number"
        min={1}
        value={h}
        onChange={(e) => setH(e.target.value)}
        className="input w-16"
      />
      <SaveBtn disabled={disabled} onClick={() => onSave(Number(g), Number(h))} />
    </Field>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-ink-faint mb-1 block font-mono text-[10px] uppercase tracking-wide">
        {label}
      </label>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function SaveBtn({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="bg-accent text-base rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
    >
      Save
    </button>
  );
}

function AddSourceForm() {
  return (
    <form
      action={addSource}
      className="border-border mt-4 grid gap-2 border-t pt-4 sm:grid-cols-[1fr_auto_2fr_auto_auto]"
    >
      <input name="name" placeholder="Name" required className="input" />
      <select name="type" defaultValue="rss" className="input">
        <option value="rss">rss</option>
        <option value="reddit">reddit</option>
        <option value="youtube">youtube</option>
        <option value="google_news">google_news</option>
      </select>
      <input name="url" placeholder="Feed URL" required className="input" />
      <input
        name="weight"
        type="number"
        step="0.1"
        defaultValue="1.0"
        title="Score weight"
        className="input w-20"
      />
      <button
        type="submit"
        className="bg-accent text-base inline-flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
      >
        <Plus className="h-3.5 w-3.5" /> Add
      </button>
    </form>
  );
}
