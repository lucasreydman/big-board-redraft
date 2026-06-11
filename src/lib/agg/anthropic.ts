import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "./constants";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    client = new Anthropic();
  }
  return client;
}

function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Tolerant JSON extraction: strips ``` fences and pulls the first {...}/[...]. */
function parseJson<T>(raw: string): T | null {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s) as T;
  } catch {
    // Fall back to the first balanced array/object substring.
    const start = s.search(/[[{]/);
    const end = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// --- Prompts -------------------------------------------------------------

const SCORE_SYSTEM = `You score NBA news items for The Modern NBA, an X account focused on
analysis, culture, and the evolution of the game. Audience: hardcore NBA
fans, fantasy basketball players, draft enthusiasts.

Score each item 1-10:
9-10: major breaking news (trades, injuries to stars, signings, firings)
7-8:  strong analysis angles, milestone performances, draft intel,
      meaningful stats or trends
4-6:  routine game recaps, minor roster moves, generic content
1-3:  clickbait, old news, off-topic, gossip without substance

Penalize: items older than 24 hours, duplicate angles on already-covered
stories, pure speculation with no sourcing.
Boost: stories with a clear analytical or "evolution of the game" angle.

Return ONLY a JSON array: [{"id": "...", "score": N, "reason": "..."}]`;

const DRAFT_SYSTEM = `You write posts for The Modern NBA (@TheModernNBA). Voice: sharp,
analytical, confident, modern. Like a smart friend who watches every
game. No corporate tone, no hashtag spam, no "BREAKING:" cliches unless
genuinely breaking, no engagement-bait questions.

Rules:
- Under 270 characters (links count as 23 via t.co)
- Use ONLY facts present in the provided source text. Never add stats,
  quotes, or context from outside it
- Transform the content: your own framing, never copy source phrasing
- Lead with the insight or the number, not the source
- Attribution: end with "via [Source]" plus the URL
- One emoji max, only when it genuinely fits

Return ONLY the post text.`;

const VERIFY_SYSTEM = `You are a strict fact-checker for an automated NBA posting system.
You receive a drafted post and the source text it was written from.

Fail the draft if ANY of these are true:
- A name, number, stat, team, date, or outcome in the draft does not
  appear in the source text
- The draft contains a quote not present verbatim in the source
- The draft copies source phrasing nearly word-for-word
- The draft is off-topic, defamatory, or inflammatory
- The draft exceeds 280 characters including a 23-char link

Otherwise pass.
Return ONLY: {"pass": true|false, "reason": "..."}`;

// --- Stage functions -----------------------------------------------------

export interface ScoreInput {
  id: string;
  title: string;
  summary: string | null;
  source: string;
  published_at: string | null;
}

export interface ScoreResult {
  id: string;
  score: number;
  reason: string;
}

export async function scoreItems(
  items: ScoreInput[],
): Promise<ScoreResult[]> {
  if (items.length === 0) return [];

  const payload = items.map((it) => ({
    id: it.id,
    source: it.source,
    title: it.title,
    summary: (it.summary ?? "").slice(0, 400),
    published_at: it.published_at,
  }));

  const msg = await anthropic().messages.create({
    model: MODELS.score,
    max_tokens: 2000,
    system: SCORE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Score these ${items.length} items:\n\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
  });

  const parsed = parseJson<ScoreResult[]>(textOf(msg));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((r) => r && typeof r.id === "string" && Number.isFinite(Number(r.score)))
    .map((r) => ({
      id: r.id,
      score: Number(r.score),
      reason: String(r.reason ?? "").slice(0, 500),
    }));
}

export async function draftPost(input: {
  title: string;
  sourceName: string;
  url: string;
  sourceText: string;
}): Promise<string> {
  const msg = await anthropic().messages.create({
    model: MODELS.draft,
    max_tokens: 600,
    system: DRAFT_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Source: ${input.sourceName}\nURL: ${input.url}\nHeadline: ${input.title}\n\n` +
          `Source text:\n"""\n${input.sourceText}\n"""\n\n` +
          `Write the post. End with: via ${input.sourceName} ${input.url}`,
      },
    ],
  });
  return textOf(msg);
}

export interface VerifyResult {
  pass: boolean;
  reason: string;
}

export async function verifyDraft(input: {
  draft: string;
  sourceText: string;
}): Promise<VerifyResult> {
  const msg = await anthropic().messages.create({
    model: MODELS.verify,
    max_tokens: 400,
    system: VERIFY_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `DRAFT:\n${input.draft}\n\n` +
          `SOURCE TEXT:\n"""\n${input.sourceText}\n"""`,
      },
    ],
  });

  const parsed = parseJson<VerifyResult>(textOf(msg));
  if (!parsed || typeof parsed.pass !== "boolean") {
    // Fail closed: if the verifier output is unparseable, don't publish.
    return { pass: false, reason: "verifier returned unparseable output" };
  }
  return { pass: parsed.pass, reason: String(parsed.reason ?? "").slice(0, 500) };
}
