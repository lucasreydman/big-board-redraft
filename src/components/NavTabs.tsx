"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
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
        <div className="flex items-center justify-between pt-3">
          <div className="flex items-baseline gap-3">
            <span className="display text-ink text-xl font-bold leading-none">
              The <span className="text-accent">Board</span>
            </span>
            <span className="text-ink-faint hidden font-mono text-[11px] uppercase tracking-[0.2em] sm:inline">
              Redraft / Big Board
            </span>
          </div>
          <div className="flex items-center gap-3">
            {email && (
              <span className="text-ink-faint hidden font-mono text-xs lg:inline">
                {email}
              </span>
            )}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-ink-muted hover:text-ink border-border hover:border-border-strong inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors duration-150"
              >
                <LogOut className="h-3 w-3" />
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="-mb-px mt-2 flex items-end gap-0.5 overflow-x-auto">
          {REDRAFT_YEARS.map((year) => (
            <Tab
              key={year}
              href={`/redraft/${year}`}
              label={String(year)}
              active={active === year}
            />
          ))}
          <span className="bg-border mx-2 mb-3 h-5 w-px shrink-0" />
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
        "display shrink-0 border-b-2 px-3 pb-2 pt-1 text-lg font-semibold leading-none transition-colors duration-150",
        active
          ? "border-accent text-ink"
          : accent
            ? "text-accent/80 hover:text-accent border-transparent"
            : "text-ink-faint hover:text-ink border-transparent",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
