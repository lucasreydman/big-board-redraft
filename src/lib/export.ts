"use client";

import { toPng } from "html-to-image";

function triggerDownload(filename: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Hand the PNG off the way the device expects: mobile Safari ignores
// <a download> for images but can share a File through the native sheet
// (Save to Photos / AirDrop). Desktop falls back to a normal download.
async function deliver(filename: string, dataUrl: string) {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: "image/png" });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
    };
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: filename });
      return;
    }
  } catch {
    // share sheet dismissed, or sharing/fetch unsupported — fall through
  }
  triggerDownload(filename, dataUrl);
}

// Mobile Safari caps a canvas at ~16.7M px total and ~8K per side. Pick the
// largest pixel ratio (<= 2) that keeps a tall board under both ceilings, so it
// rasterizes in full instead of coming back blank.
function safePixelRatio(width: number, height: number) {
  const MAX_AREA = 16_000_000;
  const MAX_SIDE = 8000;
  return Math.min(
    2,
    Math.sqrt(MAX_AREA / (width * height)),
    MAX_SIDE / width,
    MAX_SIDE / height,
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

/**
 * Export a board as a single full-height PNG.
 *
 * `node` is the inner board content (the full-width column). It lives inside a
 * scrolling, height-clamped container, so screenshotting it in place only grabs
 * the visible slice — the old "random crop". Instead we clone it into an
 * off-screen wrapper at its true height, drop the interactive chrome, and
 * rasterize that. Every image is served from our Supabase mirror
 * (Access-Control-Allow-Origin: *), so headshots and logos inline cleanly,
 * including on iOS.
 */
export async function exportPng(
  node: HTMLElement,
  filename: string,
  opts: { title?: string; subtitle?: string } = {},
) {
  const bg = getComputedStyle(document.body).backgroundColor || "#0a0a0b";

  // Off-screen STAGE holds the capture target out of view. The wrapper we
  // actually rasterize must stay statically positioned — html-to-image preserves
  // the root node's own offsets, so a translated/fixed root renders off-canvas
  // (a fully blank image).
  const stage = document.createElement("div");
  stage.style.cssText = "position:fixed;left:-100000px;top:0;z-index:-1";
  const wrap = document.createElement("div");
  wrap.style.cssText = `padding:24px;background:${bg}`;
  wrap.style.width = `${node.offsetWidth}px`;

  if (opts.title) {
    const head = document.createElement("div");
    head.style.cssText = "padding:0 4px 16px";
    head.innerHTML =
      `<div class="display text-ink" style="font-size:30px;font-weight:700;line-height:1.1">${escapeHtml(opts.title)}</div>` +
      (opts.subtitle
        ? `<div class="text-ink-faint" style="margin-top:6px;font-family:ui-monospace,monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase">${escapeHtml(opts.subtitle)}</div>`
        : "");
    wrap.appendChild(head);
  }

  const clone = node.cloneNode(true) as HTMLElement;
  // Sticky headers / rails have no scroll context here — pin them to normal flow
  // so they render once at the top/left instead of floating.
  clone
    .querySelectorAll<HTMLElement>(".sticky")
    .forEach((el) => (el.style.position = "static"));
  // Drag handles are the only always-visible control; everything else reveals on
  // hover and stays hidden in this static copy.
  clone
    .querySelectorAll<HTMLElement>('[aria-label^="Drag "]')
    .forEach((el) => (el.style.display = "none"));
  clone.querySelectorAll("img").forEach((img) => {
    img.loading = "eager";
    img.setAttribute("crossorigin", "anonymous");
  });
  wrap.appendChild(clone);
  stage.appendChild(wrap);
  document.body.appendChild(stage);

  try {
    await document.fonts?.ready;
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const width = wrap.offsetWidth;
    const height = wrap.offsetHeight;
    const dataUrl = await toPng(wrap, {
      backgroundColor: bg,
      pixelRatio: safePixelRatio(width, height),
      cacheBust: false,
      width,
      height,
    });
    await deliver(filename, dataUrl);
  } finally {
    stage.remove();
  }
}
