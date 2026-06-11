import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AggDatabase } from "./types";

// Service-role Supabase client for the aggregator. Bypasses RLS, so it must
// only ever run server-side. The `server-only` import makes a client-bundle
// import a build error.
//
// Reuses the ingestion env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)
// already documented in .env.example; falls back to the public URL so local
// setups that only set NEXT_PUBLIC_SUPABASE_URL still work.

let cached: SupabaseClient<AggDatabase> | null = null;

export function aggAdmin(): SupabaseClient<AggDatabase> {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Aggregator requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  cached = createClient<AggDatabase>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
