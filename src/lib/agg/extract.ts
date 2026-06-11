import "server-only";
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { PIPELINE } from "./constants";

// Best-effort article text extraction. Readability first, then a crude
// paragraph scrape, capped at PIPELINE.sourceTextMaxChars. Callers fall back
// to the RSS summary when this returns empty (see the failure table in the PRD).

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, PIPELINE.sourceTextMaxChars);
}

export async function extractArticleText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TMNAggregator/1.0; +https://themodernnba)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(PIPELINE.sourceTimeoutMs),
    });
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return "";

    const html = await res.text();
    // linkedom gives a DOM Readability can consume.
    const { document } = parseHTML(html);

    try {
      const article = new Readability(
        document as unknown as Document,
      ).parse();
      if (article?.textContent && article.textContent.trim().length > 200) {
        return clean(article.textContent);
      }
    } catch {
      // fall through to the paragraph scrape
    }

    const paras = Array.from(document.querySelectorAll("article p, main p, p"))
      .map((p) => p.textContent ?? "")
      .filter((t) => t.trim().length > 40)
      .join("\n");
    return clean(paras);
  } catch {
    return "";
  }
}
