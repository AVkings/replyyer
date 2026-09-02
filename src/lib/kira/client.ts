/**
 * Kira AI — OpenAI-compatible client
 * Base URL: https://kiraai.vn/api/v1
 * Model: hy3
 *
 * Why OpenAI SDK?
 * - Kira exposes an OpenAI-compatible API, so the official `openai` SDK works
 *   with baseURL override. Single SDK for chat, embeddings, tool-calling.
 * - Keeps code portable if you swap providers later.
 */

import OpenAI from "openai";

let kiraClient: OpenAI | null = null;

export function getKiraClient(): OpenAI {
  const apiKey = process.env.KIRA_API_KEY;
  const baseURL = process.env.KIRA_BASE_URL ?? "https://kiraai.vn/api/v1";

  if (!apiKey) {
    throw new Error("Missing env var KIRA_API_KEY");
  }

  if (!kiraClient) {
    kiraClient = new OpenAI({
      apiKey,
      baseURL,
    });
  }

  return kiraClient;
}

export const KIRA_MODEL = process.env.KIRA_MODEL ?? "hy3";

/**
 * Embedding helper with fallback.
 * Kira's /embeddings is 404 (chat-only models like hy3). We try Kira first,
 * then gracefully return null so ingestion can store without vector and
 * retrieve can fallback to text search (ILIKE) instead of failing all chunks.
 */
export async function createEmbedding(input: string): Promise<number[] | null> {
  const client = getKiraClient();
  const embeddingModel = process.env.KIRA_EMBEDDING_MODEL ?? KIRA_MODEL;

  try {
    const res = await client.embeddings.create({
      model: embeddingModel,
      input,
    });
    const embedding = res.data[0]?.embedding;
    if (!embedding) throw new Error("Kira embedding returned no data");
    return embedding;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Kira returns 404 Cannot POST /api/v1/embeddings — chat-only, no embeddings
    if (msg.includes("404") || msg.includes("Cannot POST") || msg.includes("embeddings")) {
      console.warn(`[kira] embeddings not available on ${embeddingModel} (${msg.slice(0,120)}), will store without vector and use text search fallback`);
      return null;
    }
    throw e;
  }
}

/**
 * Chat helper — thin wrapper so Phases 3-4 can call with RAG context.
 */
export async function createChatCompletion(params: {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  tools?: OpenAI.Chat.ChatCompletionTool[];
  tool_choice?: OpenAI.Chat.ChatCompletionToolChoiceOption;
  temperature?: number;
  max_tokens?: number;
}) {
  const client = getKiraClient();
  return client.chat.completions.create({
    model: KIRA_MODEL,
    messages: params.messages,
    tools: params.tools,
    tool_choice: params.tool_choice,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.max_tokens,
  });
}
