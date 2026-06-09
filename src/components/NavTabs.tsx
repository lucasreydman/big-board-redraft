"use client";

import Link from "next/link";
import { REDRAFT_YEARS, PROSPECT_YEAR } from "@/lib/constants";

export function NavTabs({
  active,
  email,
}: {
  // Either a redraft year, or "board" for the 2026 big board.
  active: number | "board";
  email: string | null;
}) {
  return (
    <header className="border-border bg-base/90 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-5">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-baseline gap-3">
            <span className="text-accent font-mono text-[11px] tracking-[0.3em] uppercase">
              The Board
            </span>
            <span className="text-ink-faint hidden text-xs sm:inline">
              redraft &amp; big-board terminal
            </span>
          </div>
          <div className="flex items-center gap-3">
            {email && (
              <span className="text-ink-faint hidden font-mono text-xs sm:inline">
                {email}
              </span>
            )}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-ink-muted hover:text-ink border-border hover:border-border-strong rounded-md border px-2.5 py-1 text-xs transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto pb-2">
          {REDRAFT_YEARS.map((year) => (
            <Tab
              key={year}
              href={`/redraft/${year}`}
              label={String(year)}
              active={active === year}
            />
          ))}
          <span className="bg-border mx-2 h-5 w-px shrink-0" />
          <Tab
            href="/big-board"
            label={`${PROSPECT_YEAR} Board`}
            active={active === "board"}
            accent
          />
        </nav>
      </div>
    </header>
  );
}

function Tab({
  href,
  label,
  active,
  accent,
}: {
  href: string;
  label: string;
  active: boolean;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "shrink-0 rounded-md px-3 py-1.5 font-mono text-sm transition-colors",
        active
          ? "bg-accent text-base font-semibold"
          : accent
            ? "text-accent hover:bg-surface-2"
            : "text-ink-muted hover:bg-surface-2 hover:text-ink",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
