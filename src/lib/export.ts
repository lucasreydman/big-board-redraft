"use client";

import { toPng } from "html-to-image";

function download(filename: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null)[][],
) {
  const lines = [headers, ...rows].map((row) =>
    row.map(csvCell).join(","),
  );
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  download(filename, url);
  URL.revokeObjectURL(url);
}

export async function exportPng(node: HTMLElement, filename: string) {
  // Render at 2x for a crisp share image; pull the background from the page.
  const bg =
    getComputedStyle(document.body).backgroundColor || "#0a0a0b";
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    backgroundColor: bg,
    cacheBust: true,
  });
  download(filename, dataUrl);
}
