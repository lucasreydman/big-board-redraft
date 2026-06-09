"use client";

import { useState } from "react";

// A clean rounded headshot frame. Falls back to a silhouette on 404 / missing
// URL (players who never played, dead CDN links, prospects without an ESPN id).
export function Headshot({
  src,
  alt,
  size = 40,
}: {
  src: string | null | undefined;
  alt: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showSilhouette = !src || failed;

  return (
    <div
      className="bg-surface-2 ring-border relative shrink-0 overflow-hidden rounded-full ring-1"
      style={{ width: size, height: size }}
    >
      {showSilhouette ? (
        <Silhouette />
      ) : (
        // Plain img (not next/image) so an onError fallback is reliable across
        // hotlinked CDNs and mirrored storage URLs alike.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={alt}
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
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
