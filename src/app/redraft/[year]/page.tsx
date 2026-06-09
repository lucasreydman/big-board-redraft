import { notFound } from "next/navigation";
import { NavTabs } from "@/components/NavTabs";
import { RedraftTable } from "@/components/redraft/RedraftTable";
import { REDRAFT_YEARS } from "@/lib/constants";
import {
  getCurrentUserEmail,
  getPlayersByYear,
  getRedraftOrder,
} from "@/lib/data";

// Auth-gated and cookie-dependent, so always rendered per request.
export const dynamic = "force-dynamic";

export default async function RedraftYearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  if (!REDRAFT_YEARS.includes(year as (typeof REDRAFT_YEARS)[number])) {
    notFound();
  }

  const [players, savedOrder, email] = await Promise.all([
    getPlayersByYear(year),
    getRedraftOrder(year),
    getCurrentUserEmail(),
  ]);

  // Start from the saved order if present; append any players missing from it
  // (e.g. if the class was re-ingested) so nobody gets dropped. Otherwise use
  // the actual draft order.
  const actualOrder = players.map((p) => p.id);
  let initialOrder: string[];
  if (savedOrder && savedOrder.length) {
    const known = new Set(actualOrder);
    const seen = new Set<string>();
    initialOrder = savedOrder.filter((id) => {
      if (!known.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    for (const id of actualOrder) if (!seen.has(id)) initialOrder.push(id);
  } else {
    initialOrder = actualOrder;
  }

  return (
    <>
      <NavTabs active={year} email={email} />
      <main className="mx-auto max-w-[1600px] px-5 py-6">
        {players.length === 0 ? (
          <EmptyState year={year} />
        ) : (
          <RedraftTable
            year={year}
            players={players}
            initialOrder={initialOrder}
          />
        )}
      </main>
    </>
  );
}

function EmptyState({ year }: { year: number }) {
  return (
    <div className="border-border bg-surface text-ink-muted rounded-xl border p-10 text-center">
      <p className="text-ink font-medium">No data for the {year} class yet.</p>
      <p className="mt-1 text-sm">
        Run the ingestion script to populate it:
      </p>
      <code className="bg-surface-2 text-accent mt-3 inline-block rounded-md px-3 py-1.5 font-mono text-xs">
        python ingest/ingest_historical.py --years {year}
      </code>
    </div>
  );
}
