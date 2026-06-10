"use client";

import { useState } from "react";

// A rounded headshot frame with an optional team/position accent ring.
// One cache-busted retry on load failure (network blips shouldn't stick),
// then a silhouette fallback (players who never played, dead links).
export function Headshot({
  src,
  alt,
  size = 56,
  accent,
}: {
  src: string | null | undefined;
  alt: string;
  size?: number;
  accent?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const showSilhouette = !src || attempt >= 2;
  const effectiveSrc =
    src && attempt === 1 ? `${src}${src.includes("?") ? "&" : "?"}r=1` : src;

  return (
    <div
      className="bg-surface-3 relative shrink-0 overflow-hidden rounded-xl"
      style={{
        width: size,
        height: size,
        boxShadow: accent
          ? `inset 0 0 0 1.5px ${accent}55, inset 0 -2px 0 0 ${accent}`
          : "inset 0 0 0 1px var(--color-border)",
      }}
    >
      {showSilhouette ? (
        <Silhouette />
      ) : (
        // Plain img (not next/image) so an onError fallback is reliable across
        // hotlinked CDNs and mirrored storage URLs alike.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={effectiveSrc!}
          alt={alt}
          width={size}
          height={size}
          loading="lazy"
          onError={() => setAttempt((a) => a + 1)}
          className="h-full w-full object-cover object-top"
        />
      )}
    </div>
  );
}

function Silhouette() {
  return (
    <svg
      viewBox="0 0 40 40"
      className="text-ink-faint h-full w-full"
      aria-hidden="true"
    >
      <rect width="40" height="40" fill="transparent" />
      <circle cx="20" cy="15" r="7" fill="currentColor" opacity="0.5" />
      <path
        d="M6 38c0-8 6.5-13 14-13s14 5 14 13"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  );
}
