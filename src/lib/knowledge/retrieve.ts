/**
 * RAG Retrieval Utility
 * Takes user query → embedding (Kira hy3) → pgvector similarity search via match_knowledge_bases RPC
 * Returns top relevant chunks for prompt augmentation.
 */

import { createEmbedding } from "@/lib/kira/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RetrievedChunk = {
  id: string;
  organization_id: string;
  url_source: string | null;
  content_text: string;
  similarity: number;
};

export type RetrieveOptions = {
  /** Similarity threshold (0-1). Default 0.3 lowered for demo, originally 0.78 was too strict for small datasets */
  threshold?: number;
  /** Max chunks to retrieve. Default 5 */
  count?: number;
};

/**
 * Retrieve top-k knowledge chunks relevant to `query` for a given organization.
 * Falls back to debug RPC (no threshold) if primary returns empty, to surface *something* during demo.
 */
export async function retrieveRelevantChunks(
  query: string,
  organizationId: string,
  opts: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const threshold = opts.threshold ?? 0.3;
  const count = opts.count ?? 5;

  if (!query || !query.trim()) return [];
  if (!organizationId) throw new Error("retrieveRelevantChunks: organizationId required");

  const trimmed = query.trim().slice(0, 4000); // guard

  const admin = createSupabaseAdminClient();

  let embedding: number[];
  try {
    embedding = await createEmbedding(trimmed);
  } catch (e) {
    console.error("[retrieve] embedding failed:", e);
    // Return empty so chat can still respond without context (graceful degradation)
    return [];
  }

  // Primary: thresholded RPC
  const { data, error } = await admin.rpc("match_knowledge_bases", {
    query_embedding: embedding as unknown as string, // supabase-js will stringify vector properly if we cast
    p_organization_id: organizationId,
    match_threshold: threshold,
    match_count: count,
  });

  if (error) {
    console.warn("[retrieve] match_knowledge_bases error:", error.message);
    // Try debug RPC (no threshold) as fallback
    const { data: fallback, error: fallbackErr } = await admin.rpc("match_knowledge_bases_debug", {
      query_embedding: embedding as unknown as string,
      p_organization_id: organizationId,
      match_count: count,
    });

    if (fallbackErr) {
      console.error("[retrieve] fallback also failed:", fallbackErr.message);
      return [];
    }

    return (fallback as RetrievedChunk[] | null) ?? [];
  }

  // If threshold filtered everything, try without threshold (debug) to at least show something in demo
  if (!data || data.length === 0) {
    const { data: fallback } = await admin.rpc("match_knowledge_bases_debug", {
      query_embedding: embedding as unknown as string,
      p_organization_id: organizationId,
      match_count: count,
    });

    if (fallback && fallback.length > 0) {
      // Return fallback but keep similarity scores
      return fallback as RetrievedChunk[];
    }
  }

  return (data as RetrievedChunk[] | null) ?? [];
}

/**
 * Formats retrieved chunks into a context block for the system prompt.
 */
export function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  if (!chunks || chunks.length === 0) return "No relevant knowledge base context found.";
  return chunks
    .map(
      (c, i) =>
        `[Context ${i + 1} | Source: ${c.url_source ?? "unknown"} | similarity: ${c.similarity.toFixed(3)}]\n${c.content_text}`
    )
    .join("\n\n---\n\n");
}
