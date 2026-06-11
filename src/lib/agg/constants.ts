// TMN Aggregator — shared constants.
//
// These are server-only modules; nothing here is imported into client bundles.

/** Claude models, per pipeline stage. Tunable here without touching call sites. */
export const MODELS = {
  // Scoring + verification: cheap, fast, batched.
  score: "claude-haiku-4-5",
  verify: "claude-haiku-4-5",
  // Drafting: the post is the public-facing artifact, so use the stronger model.
  draft: "claude-sonnet-4-6",
} as const;

/** Owner gate for the in-app /news surface. Falls back to the project owner. */
export const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ?? "lucasreydman@gmail.com"
).toLowerCase();

/** Pipeline tuning that is not owner-editable at runtime. */
export const PIPELINE = {
  /** Max new items scored per orchestrator run. */
  scoreBatchSize: 25,
  /** Max items drafted per run (drafting is the priciest stage). */
  draftBatchSize: 8,
  /** Per-source fetch timeout. */
  sourceTimeoutMs: 10_000,
  /** Article extraction cap, characters (~3k tokens). */
  sourceTextMaxChars: 12_000,
  /** Fuzzy dedupe window for ingest (hours). */
  dedupeWindowHours: 48,
  /** Trigram similarity threshold above which two headlines are "the same". */
  dedupeSimilarity: 0.6,
  /** Trigram similarity above which a draft duplicates a recently posted item. */
  postedDedupeSimilarity: 0.45,
  /** Recently-posted lookback for the publish-time dedupe (hours). */
  postedDedupeWindowHours: 72,
  /** Queued items older than this auto-expire (hours). */
  queueTtlHours: 24,
  /** Random jitter added before a publish, minutes. */
  maxJitterMinutes: 7,
  /** Auto-deactivate a source after this many consecutive failures. */
  maxSourceFailures: 10,
  /** Rejected items older than this are deleted (days). */
  rejectedRetentionDays: 30,
} as const;

/** Surge-mode overrides, applied while surge is on. */
export const SURGE = {
  scoreThreshold: 6,
  minGapMinutes: 15,
  maxPerHour: 4,
  durationHours: 12,
} as const;
