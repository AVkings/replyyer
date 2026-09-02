/**
 * Scraping Utility — URL → clean readable text
 * Server-only. Uses cheerio for lightweight HTML parsing.
 */

import * as cheerio from "cheerio";

export type ScrapeResult = {
  url: string;
  title: string;
  text: string;
};

const SCRAPE_TIMEOUT_MS = 15000;
const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5MB guard

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Fetches HTML and extracts clean text.
 * - Strips <script>, <style>, <noscript>, <template>, <svg>, <canvas>
 * - Removes nav, footer, header, aside, form if they look like boilerplate (but keeps main article)
 * - Extracts headings, paragraphs, list items, blockquotes, table cells
 * - Normalizes whitespace and de-duplicates lines
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  if (!url || typeof url !== "string") {
    throw new Error("URL is required");
  }

  const trimmed = url.trim();

  if (!isValidHttpUrl(trimmed)) {
    throw new Error("Invalid URL — must start with http:// or https://");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(trimmed, {
      signal: controller.signal,
      headers: {
        // Pretend to be a normal browser to avoid basic bot blocking
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 RepllyerBot/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      // fetch follows redirects by default (up to 20). Good for us.
      cache: "no-store",
      redirect: "follow",
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timed out after ${SCRAPE_TIMEOUT_MS / 1000}s for ${trimmed}`);
    }
    throw new Error(`Failed to fetch ${trimmed}: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`Fetch failed for ${trimmed}: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    // Some sites serve HTML with weird content-type; we warn but still try
    if (contentType.includes("application/json") || contentType.includes("image/") || contentType.includes("application/pdf")) {
      throw new Error(`URL does not appear to be an HTML page (content-type: ${contentType})`);
    }
  }

  // Guard against huge pages
  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_HTML_BYTES) {
    throw new Error(`Page too large (${contentLength} bytes) — limit is ${MAX_HTML_BYTES} bytes`);
  }

  const html = await res.text();
  if (!html || html.length < 100) {
    throw new Error(`Empty or tiny response from ${trimmed} — page may be blocked or requires JS rendering`);
  }

  if (html.length > MAX_HTML_BYTES) {
    throw new Error(`HTML payload too large (${html.length} bytes)`);
  }

  const $ = cheerio.load(html);

  // Remove noise elements entirely
  $(
    "script, style, noscript, template, svg, canvas, iframe, object, embed, link[rel='stylesheet']"
  ).remove();

  // Remove hidden elements (common pattern)
  $("[hidden], [style*='display:none'], [style*='display: none']").remove();

  // Heuristic: remove obvious boilerplate but preserve article content
  // We keep <main> and <article> intact — only strip nav/footer outside them
  $("nav, footer").remove();
  // Remove header only if there's a <main> or <article> (so we keep the hero title when page is simple)
  if ($("main, article").length > 0) {
    $("header").remove();
  }
  // Remove cookie banners, newsletter popups by common ids/classes
  $("[id*='cookie'], [class*='cookie'], [id*='newsletter'], [class*='newsletter'], [id*='popup'], [class*='popup']").remove();

  // Title
  const title =
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    trimmed;

  // Strategy: prefer <main> or <article> if present, else <body>
  let container = $("main").first();
  if (container.length === 0) container = $("article").first();
  if (container.length === 0) container = $("body");

  const lines: string[] = [];

  // Extract in document order: headings, paragraphs, list items, blockquotes, table cells, dt/dd
  container
    .find("h1, h2, h3, h4, h5, h6, p, li, blockquote, td, th, dt, dd, pre, code")
    .each((_, el) => {
      const tag = el.tagName.toLowerCase();
      let text = $(el).text().replace(/\s+/g, " ").trim();

      if (!text || text.length < 3) return;
      // Skip nav-like tiny fragments
      if (text.length < 20 && /^(home|menu|search|login|sign in|sign up|subscribe|follow us|share)$/i.test(text)) {
        return;
      }

      // Prefix headings with markdown-style markers for better embedding signal
      if (tag.startsWith("h")) {
        const level = Number(tag[1]);
        const prefix = "#".repeat(level);
        text = `${prefix} ${text}`;
      } else if (tag === "li") {
        text = `• ${text}`;
      } else if (tag === "blockquote") {
        text = `> ${text}`;
      }

      lines.push(text);
    });

  // Fallback: if container strategy yielded almost nothing, grab all body text
  if (lines.join("\n").length < 200) {
    const fallback = container
      .text()
      .replace(/\s+/g, " ")
      .trim();
    if (fallback.length > lines.join("\n").length) {
      lines.length = 0;
      // Split fallback into pseudo-paragraphs by double space
      fallback
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 20)
        .forEach((s) => lines.push(s));
    }
  }

  // De-duplicate consecutive identical lines and collapse
  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] !== line) deduped.push(line);
  }

  let cleanText = deduped.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();

  // Final whitespace normalize per line
  cleanText = cleanText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n");

  if (!cleanText || cleanText.length < 100) {
    throw new Error(
      `Could not extract readable text from ${trimmed} — page may be JS-rendered or blocked. Try a docs/help page with static HTML.`
    );
  }

  // Hard cap to avoid absurd DB inserts (chunking will handle it, but we cap source too)
  const MAX_CHARS = 200_000;
  if (cleanText.length > MAX_CHARS) {
    cleanText = cleanText.slice(0, MAX_CHARS);
  }

  return { url: trimmed, title: title.slice(0, 300), text: cleanText };
}
