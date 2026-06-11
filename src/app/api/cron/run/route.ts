import { NextResponse, type NextRequest } from "next/server";
import { runPipeline } from "@/lib/agg/pipeline";

// Single orchestrator route, hit by Vercel Cron every 30 min. Vercel attaches
// `Authorization: Bearer <CRON_SECRET>` automatically when CRON_SECRET is set;
// anything else is rejected.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if not configured
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runPipeline();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "pipeline error" },
      { status: 500 },
    );
  }
}
