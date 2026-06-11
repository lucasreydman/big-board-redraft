import "server-only";
import OAuth from "oauth-1.0a";
import { createHmac } from "node:crypto";

// Minimal X (Twitter) API v2 client. POST /2/tweets with OAuth 1.0a user
// context. The JSON body is NOT part of the OAuth signature base string (only
// oauth_* params), so signing is straightforward.

const TWEETS_URL = "https://api.twitter.com/2/tweets";

export function xConfigured(): boolean {
  return Boolean(
    process.env.X_API_KEY &&
      process.env.X_API_SECRET &&
      process.env.X_ACCESS_TOKEN &&
      process.env.X_ACCESS_SECRET,
  );
}

export interface PostResult {
  ok: boolean;
  tweetId?: string;
  error?: string;
}

export async function postTweet(text: string): Promise<PostResult> {
  if (!xConfigured()) {
    return { ok: false, error: "X API credentials not configured" };
  }

  const oauth = new OAuth({
    consumer: {
      key: process.env.X_API_KEY as string,
      secret: process.env.X_API_SECRET as string,
    },
    signature_method: "HMAC-SHA1",
    hash_function(base, key) {
      return createHmac("sha1", key).update(base).digest("base64");
    },
  });

  const token = {
    key: process.env.X_ACCESS_TOKEN as string,
    secret: process.env.X_ACCESS_SECRET as string,
  };

  const authHeader = oauth.toHeader(
    oauth.authorize({ url: TWEETS_URL, method: "POST" }, token),
  );

  try {
    const res = await fetch(TWEETS_URL, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(15_000),
    });

    const json = (await res.json().catch(() => ({}))) as {
      data?: { id?: string };
      detail?: string;
      title?: string;
      errors?: { message?: string }[];
    };

    if (res.ok && json.data?.id) {
      return { ok: true, tweetId: json.data.id };
    }
    const error =
      json.detail ??
      json.errors?.[0]?.message ??
      json.title ??
      `X API error ${res.status}`;
    return { ok: false, error };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}
