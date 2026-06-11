// Database row shapes for the agg_ tables and a minimal typed Database for the
// service-role client. Hand-written (the project keeps types hand-written; see
// src/lib/supabase/database.types.ts).

export type AggSourceType = "rss" | "reddit" | "youtube" | "google_news";

export type AggItemStatus =
  | "new"
  | "rejected_score"
  | "scored"
  | "drafted"
  | "rejected_verify"
  | "queued"
  | "posted"
  | "failed"
  | "expired";

// NOTE: these are `type` aliases, not `interface`s, on purpose. supabase-js's
// GenericSchema requires each Row to satisfy Record<string, unknown>; named
// interfaces lack the implicit index signature and silently degrade the typed
// client to `never`, whereas object-literal type aliases do not.
export type AggSource = {
  id: string;
  name: string;
  type: AggSourceType;
  url: string;
  weight: number;
  is_active: boolean;
  last_fetched_at: string | null;
  failure_count: number;
  created_at: string;
};

export type AggItem = {
  id: string;
  source_id: string | null;
  url: string;
  url_hash: string;
  title: string;
  summary: string | null;
  source_text: string | null;
  published_at: string | null;
  status: AggItemStatus;
  score: number | null;
  score_reason: string | null;
  draft_text: string | null;
  verify_reason: string | null;
  tweet_id: string | null;
  posted_at: string | null;
  created_at: string;
};

export type AggQuota = {
  month: string;
  posts_used: number;
  cap: number;
};

export type AggConfigRow = {
  key: string;
  value: unknown;
  updated_at: string;
};

/** A normalized item from a source, before dedupe / insertion. */
export interface NormalizedItem {
  url: string;
  title: string;
  summary: string | null;
  published_at: string | null;
}

/** Typed Database for the service-role client (agg_ tables only). */
import type { Json } from "@/lib/supabase/database.types";

export interface AggDatabase {
  public: {
    Tables: {
      agg_sources: {
        Row: AggSource;
        Insert: Partial<AggSource> & {
          name: string;
          type: AggSourceType;
          url: string;
        };
        Update: Partial<AggSource>;
        Relationships: [];
      };
      agg_items: {
        Row: AggItem;
        Insert: Partial<AggItem> & {
          url: string;
          url_hash: string;
          title: string;
        };
        Update: Partial<AggItem>;
        Relationships: [];
      };
      agg_quota: {
        Row: AggQuota;
        Insert: Partial<AggQuota> & { month: string };
        Update: Partial<AggQuota>;
        Relationships: [];
      };
      agg_config: {
        Row: AggConfigRow;
        Insert: { key: string; value: Json; updated_at?: string };
        Update: { key?: string; value?: Json; updated_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      agg_reserve_quota: {
        Args: { p_month: string; p_cap: number };
        Returns: boolean;
      };
      agg_release_quota: {
        Args: { p_month: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
