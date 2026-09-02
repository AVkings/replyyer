"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createEmbedding } from "@/lib/kira/client";
import { scrapeUrl } from "@/lib/knowledge/scrape";
import { chunkText } from "@/lib/knowledge/chunk";

// ──────────────────────────────────────────────
// Types returned to the UI (serializable)
// ──────────────────────────────────────────────
export type IngestResult =
  | {
      success: true;
      url: string;
      title: string;
      organizationId: string;
      chunksIngested: number;
      totalChars: number;
      previewChunks: string[];
    }
  | {
      success: false;
      error: string;
      details?: string;
    };

/**
 * ingestKnowledgeBaseAction
 *
 * Server Action: paste URL → scrape → chunk → embed → store
 *
 * @param formData  expects `url` (string) and optional `organizationId` (uuid)
 * @returns IngestResult
 *
 * Why server action (not client fetch)?
 * - Needs SERVICE_ROLE to write to knowledge_bases (bypasses RLS)
 * - Needs KIRA_API_KEY (server-only)
 * - Cheerio is server-only
 */
export async function ingestKnowledgeBaseAction(
  formData: FormData
): Promise<IngestResult> {
  const rawUrl = formData.get("url");
  const rawOrgId = formData.get("organizationId");

  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
  let organizationId = typeof rawOrgId === "string" ? rawOrgId.trim() : "";

  if (!url) {
    return { success: false, error: "Please paste a URL to ingest." };
  }

  // Validate URL shape early
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("bad proto");
  } catch {
    return { success: false, error: "Invalid URL — must start with http:// or https://" };
  }

  try {
    const admin = createSupabaseAdminClient();

    // ── Resolve organization ──────────────────
    if (!organizationId) {
      // Try to reuse the first org (demo mode), else create a default one
      const { data: existingOrgs, error: listErr } = await admin
        .from("organizations")
        .select("id")
        .limit(1)
        .order("created_at", { ascending: true });

      if (listErr) {
        return { success: false, error: "Failed to lookup organizations", details: listErr.message };
      }

      if (existingOrgs && existingOrgs.length > 0) {
        organizationId = existingOrgs[0].id;
      } else {
        const { data: newOrg, error: createErr } = await admin
          .from("organizations")
          .insert({ name: "Demo Organization", domain: "demo.repllyer.com" })
          .select("id")
          .single();

        if (createErr || !newOrg) {
          return {
            success: false,
            error: "No organization found and failed to create a demo one",
            details: createErr?.message,
          };
        }
        organizationId = newOrg.id;
      }
    } else {
      // Validate UUID shape
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRe.test(organizationId)) {
        return { success: false, error: "Invalid organizationId — must be a UUID" };
      }
      // Verify org exists
      const { data: org, error: orgErr } = await admin
        .from("organizations")
        .select("id")
        .eq("id", organizationId)
        .single();

      if (orgErr || !org) {
        return { success: false, error: `Organization not found: ${organizationId}`, details: orgErr?.message };
      }
    }

    // ── Scrape ────────────────────────────────
    let scraped: Awaited<ReturnType<typeof scrapeUrl>>;
    try {
      scraped = await scrapeUrl(url);
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }

    // ── Chunk ────────────────────────────────
    const chunks = chunkText(scraped.text, { chunkSize: 700, overlap: 100 });
    if (chunks.length === 0) {
      return { success: false, error: "Scraped text is too short to chunk — page may be empty" };
    }

    // Guard: too many chunks (huge doc) → cap to avoid hammering embedding API
    const MAX_CHUNKS = 120;
    const chunksToProcess = chunks.slice(0, MAX_CHUNKS);
    const wasTruncated = chunks.length > MAX_CHUNKS;

    // ── De-dupe: remove previous chunks for this url+org ──
    // This makes re-ingesting idempotent.
    const { error: deleteErr } = await admin
      .from("knowledge_bases")
      .delete()
      .eq("organization_id", organizationId)
      .eq("url_source", scraped.url);

    if (deleteErr) {
      // Non-fatal — log and continue
      console.warn("[ingest] failed to delete previous chunks:", deleteErr.message);
    }

    // ── Embed + Insert (sequential to respect rate limits, with per-chunk error isolation) ──
    let ingested = 0;
    const errors: string[] = [];

    for (let i = 0; i < chunksToProcess.length; i++) {
      const chunk = chunksToProcess[i];
      try {
        const embedding = await createEmbedding(chunk);

        const { error: insertErr } = await admin.from("knowledge_bases").insert({
          organization_id: organizationId,
          url_source: scraped.url,
          content_text: chunk,
          chunk_index: i,
          embedding: embedding as unknown as string, // pgvector accepts number[] via supabase-js stringified
        });

        if (insertErr) {
          // Handle dimension mismatch with helpful message
          const msg = insertErr.message;
          if (msg.includes("vector") || msg.includes("dimension")) {
            throw new Error(
              `Embedding dimension mismatch (DB expects vector(1536) but model returned ${embedding.length}). ` +
                `Alter the column: alter table knowledge_bases alter column embedding type vector(${embedding.length}); Details: ${msg}`
            );
          }
          throw new Error(insertErr.message);
        }

        ingested++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[ingest] chunk ${i} failed:`, msg);
        errors.push(`Chunk ${i}: ${msg}`);
        // Continue to next chunk — partial success is better than total failure
      }

      // Tiny delay every 10 chunks to be nice to the API
      if ((i + 1) % 10 === 0) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    if (ingested === 0) {
      return {
        success: false,
        error: "All chunks failed to embed/store",
        details: errors.slice(0, 3).join(" | ") || "Unknown embedding error — check KIRA_API_KEY / model",
      };
    }

    return {
      success: true,
      url: scraped.url,
      title: scraped.title,
      organizationId,
      chunksIngested: ingested,
      totalChars: scraped.text.length,
      previewChunks: chunksToProcess.slice(0, 3),
      ...(wasTruncated ? { _truncated: true } : {}),
    } as IngestResult;
  } catch (e) {
    console.error("[ingestKnowledgeBaseAction] unexpected:", e);
    return {
      success: false,
      error: "Unexpected server error during ingestion",
      details: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Ingest from raw text / JSON / CSV / DB dump (paste)
 * Server Action: paste text → chunk → embed → store
 * url_source is set to `paste://<title>` for traceability
 */
export async function ingestTextKnowledgeBaseAction(formData: FormData): Promise<IngestResult> {
  const rawText = formData.get("text");
  const rawTitle = formData.get("title");
  const rawOrgId = formData.get("organizationId");

  const text = typeof rawText === "string" ? rawText.trim() : "";
  const title = typeof rawTitle === "string" ? rawTitle.trim().slice(0, 200) : "Pasted Knowledge";
  let organizationId = typeof rawOrgId === "string" ? rawOrgId.trim() : "";

  if (!text || text.length < 20) {
    return { success: false, error: "Paste at least 20 characters of text / JSON / CSV." };
  }
  if (text.length > 200_000) {
    return { success: false, error: "Text too large — max 200k chars. Split into smaller pastes." };
  }

  try {
    const admin = createSupabaseAdminClient();
    if (!organizationId) {
      const { data: existingOrgs } = await admin.from("organizations").select("id").limit(1).order("created_at", { ascending: true });
      if (existingOrgs && existingOrgs.length > 0) organizationId = existingOrgs[0].id;
      else {
        const { data: newOrg } = await admin.from("organizations").insert({ name: "Demo Organization", domain: "demo.repllyer.com" }).select("id").single();
        if (!newOrg) return { success: false, error: "No org and failed to auto-create" };
        organizationId = newOrg.id;
      }
    } else {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRe.test(organizationId)) return { success: false, error: "Invalid organizationId — must be UUID" };
    }

    // Normalize: if JSON, pretty-print; if CSV, keep as is; else plain text
    let normalized = text;
    try {
      const parsed = JSON.parse(text);
      normalized = JSON.stringify(parsed, null, 2);
    } catch {
      // not JSON, keep original
    }

    const urlSource = `paste://${title.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 80)}-${Date.now()}`;

    const chunks = chunkText(normalized, { chunkSize: 700, overlap: 100 });
    if (chunks.length === 0) return { success: false, error: "Text too short to chunk" };
    const MAX_CHUNKS = 120;
    const chunksToProcess = chunks.slice(0, MAX_CHUNKS);

    // For paste, don't delete previous — append (url_source unique)
    let ingested = 0;
    const errors: string[] = [];
    for (let i = 0; i < chunksToProcess.length; i++) {
      const chunk = chunksToProcess[i];
      try {
        const embedding = await createEmbedding(chunk);
        const { error: insertErr } = await admin.from("knowledge_bases").insert({
          organization_id: organizationId,
          url_source: urlSource,
          content_text: chunk,
          chunk_index: i,
          embedding: embedding as unknown as string,
        });
        if (insertErr) {
          if (insertErr.message.includes("vector") || insertErr.message.includes("dimension")) {
            throw new Error(`Dimension mismatch: ${insertErr.message} (embedding len ${embedding.length})`);
          }
          throw new Error(insertErr.message);
        }
        ingested++;
      } catch (e) {
        errors.push(`Chunk ${i}: ${e instanceof Error ? e.message : String(e)}`);
      }
      if ((i + 1) % 10 === 0) await new Promise((r) => setTimeout(r, 300));
    }

    if (ingested === 0) return { success: false, error: "All chunks failed", details: errors.slice(0, 3).join(" | ") };

    return {
      success: true,
      url: urlSource,
      title,
      organizationId,
      chunksIngested: ingested,
      totalChars: normalized.length,
      previewChunks: chunksToProcess.slice(0, 3),
    } as IngestResult;
  } catch (e) {
    return { success: false, error: "Unexpected error", details: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Variant for API route / programmatic call (accepts plain args, not FormData)
 */
export async function ingestKnowledgeBaseFromUrl(
  url: string,
  organizationId?: string
): Promise<IngestResult> {
  const fd = new FormData();
  fd.set("url", url);
  if (organizationId) fd.set("organizationId", organizationId);
  return ingestKnowledgeBaseAction(fd);
}

export async function ingestKnowledgeBaseFromText(
  text: string,
  title: string | undefined,
  organizationId?: string
): Promise<IngestResult> {
  const fd = new FormData();
  fd.set("text", text);
  if (title) fd.set("title", title);
  if (organizationId) fd.set("organizationId", organizationId);
  return ingestTextKnowledgeBaseAction(fd);
}
