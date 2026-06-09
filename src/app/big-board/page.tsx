import { NavTabs } from "@/components/NavTabs";
import { BigBoardClient } from "@/components/bigboard/BigBoardClient";
import { getBigBoard, getCurrentUserEmail, getProspects } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function BigBoardPage() {
  const [prospects, board, email] = await Promise.all([
    getProspects(),
    getBigBoard(),
    getCurrentUserEmail(),
  ]);

  return (
    <>
      <NavTabs active="board" email={email} />
      <main className="mx-auto max-w-[1600px] px-5 py-6">
        {prospects.length === 0 ? (
          <EmptyState />
        ) : (
          <BigBoardClient prospects={prospects} initialBoard={board} />
        )}
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <div className="border-border bg-surface text-ink-muted rounded-xl border p-10 text-center">
      <p className="text-ink font-medium">No 2026 prospects loaded yet.</p>
      <p className="mt-1 text-sm">
        Seed them from the editable CSV and run the importer:
      </p>
      <code className="bg-surface-2 text-accent mt-3 inline-block rounded-md px-3 py-1.5 font-mono text-xs">
        python ingest/ingest_prospects.py
      </code>
    </div>
  );
}
