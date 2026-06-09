"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "magic";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage("Check your email for a sign-in link.");
        return;
      }
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Account created. You can sign in now.");
        setMode("signin");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push("/redraft");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-accent font-mono text-xs tracking-[0.3em] uppercase">
            The Board
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Big&nbsp;Board&nbsp;/&nbsp;Redraft
          </h1>
          <p className="text-ink-muted mt-2 text-sm">
            Restack draft classes. Build this year&apos;s board.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="bg-surface border-border space-y-4 rounded-xl border p-6"
        >
          <div>
            <label className="text-ink-muted mb-1 block text-xs uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-surface-2 border-border focus:border-accent w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>

          {mode !== "magic" && (
            <div>
              <label className="text-ink-muted mb-1 block text-xs uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-surface-2 border-border focus:border-accent w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>
          )}

          {error && <p className="text-down text-sm">{error}</p>}
          {message && <p className="text-up text-sm">{message}</p>}

          <button
            type="submit"
            disabled={busy}
            className="bg-accent text-base hover:bg-accent/90 w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {busy
              ? "…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send magic link"}
          </button>
        </form>

        <div className="text-ink-muted mt-4 flex justify-between text-xs">
          <button
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="hover:text-ink transition-colors"
          >
            {mode === "signup" ? "Have an account? Sign in" : "Create account"}
          </button>
          <button
            onClick={() => setMode(mode === "magic" ? "signin" : "magic")}
            className="hover:text-ink transition-colors"
          >
            {mode === "magic" ? "Use password" : "Email a magic link"}
          </button>
        </div>
      </div>
    </main>
  );
}
