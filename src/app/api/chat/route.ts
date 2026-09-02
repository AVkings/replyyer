import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getKiraClient, KIRA_MODEL } from "@/lib/kira/client";
import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/knowledge/retrieve";
import { logResolvedTicketTool, handleLogResolvedTicket, parseToolArgs } from "@/lib/chat/tools";
import type OpenAI from "openai";

/**
 * Chat API — RAG + tool-calling + persistence
 *
 * Flow:
 * 1. Client sends { messages, organizationId, attachmentUrl?, sessionId?, conversationId?, customerEmail? }
 * 2. Server resolves org (or first org), ensures conversation exists
 * 3. Persists user message (with attachment_url)
 * 4. Retrieves top 5 chunks via match_knowledge_bases RPC (embedding of last user message)
 * 5. Builds system prompt with context, calls Kira hy3 with log_resolved_ticket tool enabled
 * 6. If AI returns tool_call → handleLogResolvedTicket() → insert tickets row `auto_resolved`
 *    - Then make a follow-up completion to get final user-facing answer with ticket confirmation
 * 7. Persists AI message, returns { reply, conversationId, ticketCreated?, sources }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  attachment_url?: string | null;
};

type ChatRequestBody = {
  messages: ChatMessage[];
  organizationId?: string;
  organization_id?: string; // alias
  attachment_url?: string | null;
  attachmentUrl?: string | null;
  sessionId?: string;
  session_id?: string;
  conversationId?: string;
  conversation_id?: string;
  customerEmail?: string;
  customer_email?: string;
};

function resolveOrgId(body: ChatRequestBody): string | undefined {
  return body.organizationId ?? body.organization_id;
}

function resolveAttachment(body: ChatRequestBody): string | null {
  return (body.attachment_url ?? body.attachmentUrl ?? null) as string | null;
}

function resolveSessionId(body: ChatRequestBody): string {
  const v = body.sessionId ?? body.session_id ?? body.conversationId ?? body.conversation_id;
  if (typeof v === "string" && v.trim()) return v.trim();
  // Generate ephemeral session for demo
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureOrganizationId(requested?: string): Promise<string> {
  const admin = createSupabaseAdminClient();

  if (requested) {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(requested)) throw new Error("Invalid organizationId — must be UUID");
    const { data, error } = await admin.from("organizations").select("id").eq("id", requested).single();
    if (error || !data) throw new Error(`Organization not found: ${requested}`);
    return data.id;
  }

  const { data: orgs, error } = await admin.from("organizations").select("id").order("created_at").limit(1);
  if (error) throw new Error(`Failed to lookup organization: ${error.message}`);
  if (orgs && orgs.length > 0) return orgs[0].id;

  const { data: created, error: createErr } = await admin
    .from("organizations")
    .insert({ name: "Demo Organization", domain: "demo.repllyer.com" })
    .select("id")
    .single();
  if (createErr || !created) throw new Error(`No org and auto-create failed: ${createErr?.message}`);
  return created.id;
}

async function ensureConversation(opts: {
  organizationId: string;
  sessionId: string;
  customerEmail?: string;
}): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("organization_id", opts.organizationId)
    .eq("session_id", opts.sessionId)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("conversations")
    .insert({
      organization_id: opts.organizationId,
      session_id: opts.sessionId,
      customer_email: opts.customerEmail ?? null,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(`Failed to create conversation: ${error?.message}`);
  return created.id;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as ChatRequestBody | null;

    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ success: false, error: "Missing messages array (at least 1 message required)" }, { status: 400, headers: corsHeaders });
    }

    const lastUserMsg = [...body.messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) {
      return NextResponse.json({ success: false, error: "No user message found" }, { status: 400, headers: corsHeaders });
    }

    const rawOrg = resolveOrgId(body);
    const attachmentUrl = resolveAttachment(body);
    const sessionId = resolveSessionId(body);
    const customerEmail = body.customerEmail ?? body.customer_email ?? undefined;

    // Resolve org + conversation
    const organizationId = await ensureOrganizationId(rawOrg);
    const conversationId = await ensureConversation({ organizationId, sessionId, customerEmail });

    const admin = createSupabaseAdminClient();

    // Persist user message
    const userContent = lastUserMsg.content ?? "";
    const userAttachment = (lastUserMsg.attachment_url ?? attachmentUrl) as string | null;

    await admin.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: userContent,
      attachment_url: userAttachment && /^https?:\/\//.test(userAttachment) ? userAttachment : null,
    });

    // RAG: retrieve context for last user message
    let ragChunks: Awaited<ReturnType<typeof retrieveRelevantChunks>> = [];
    let contextBlock = "No relevant knowledge base context found.";
    try {
      ragChunks = await retrieveRelevantChunks(userContent, organizationId, { threshold: 0.3, count: 5 });
      contextBlock = formatChunksForPrompt(ragChunks);
    } catch (e) {
      console.warn("[chat] RAG retrieve failed:", e);
    }

    // Build system prompt
    const systemPrompt = `You are Repllyer — an autonomous AI customer support agent.
You help customers using ONLY the knowledge base context provided. Be concise, friendly, and accurate.
If the context does not contain the answer, say you don't have that information and offer to escalate.

KNOWLEDGE BASE CONTEXT:
${contextBlock}

RULES:
- Use context verbatim when relevant; cite source URL if you use it.
- If the user uploaded an attachment (image/file link), acknowledge it and consider it in your answer.
- If you fully resolve the user's issue, you MUST call the tool log_resolved_ticket with issue_title, ai_summary, and priority_level.
- Priority: 1=trivial, 2=low, 3=medium, 4=high, 5=critical (security/data loss/outage).
- Never ask the user to call the tool; you call it yourself.
- Keep tone warm, modern, helpful.`;

    // Build messages for Kira — include history but replace system
    const kiraMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    // Map client messages to OpenAI shape, preserving attachment hint
    for (const m of body.messages) {
      if (m.role === "system") continue;
      let content = m.content ?? "";
      const att = (m as ChatMessage).attachment_url;
      if (att && /^https?:\/\//.test(att)) {
        content += `\n\n[User attached file: ${att}]`;
      }
      // Also inject current request's attachment if last message
      if (m === lastUserMsg && attachmentUrl && !content.includes(attachmentUrl)) {
        content += `\n\n[User attached file: ${attachmentUrl}]`;
      }
      kiraMessages.push({ role: m.role as "user" | "assistant", content });
    }

    const kira = getKiraClient();

    // First completion with tool
    const first = await kira.chat.completions.create({
      model: KIRA_MODEL,
      messages: kiraMessages,
      tools: [logResolvedTicketTool],
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 900,
    });

    const choice = first.choices[0];
    const toolCalls = choice.message.tool_calls;

    let ticketCreated: { ticketId: string; title: string } | null = null;
    let replyContent = choice.message.content ?? "";

    // Handle tool call if present
    if (toolCalls && toolCalls.length > 0) {
      for (const tc of toolCalls) {
        if (tc.type !== "function" || tc.function.name !== "log_resolved_ticket") continue;
        const parsed = parseToolArgs(tc.function.arguments);
        if (!parsed) {
          console.warn("[chat] invalid tool args:", tc.function.arguments);
          continue;
        }

        const res = await handleLogResolvedTicket(parsed, { organizationId, conversationId });
        if (res.success) {
          ticketCreated = { ticketId: res.ticketId, title: parsed.issue_title };
        } else {
          console.error("[chat] ticket insert failed:", res.error);
        }

        // Append tool call + tool result, then get follow-up answer
        const toolMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          ...kiraMessages,
          {
            role: "assistant",
            content: choice.message.content ?? null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tool_calls: toolCalls as any,
          } as OpenAI.Chat.ChatCompletionMessageParam,
          {
            role: "tool",
            tool_call_id: tc.id,
            content: res.success
              ? `Ticket logged successfully: ${res.ticketId} for "${parsed.issue_title}"`
              : `Ticket log failed: ${res.error}`,
          } as unknown as OpenAI.Chat.ChatCompletionMessageParam,
        ];

        const followUp = await kira.chat.completions.create({
          model: KIRA_MODEL,
          messages: toolMessages,
          temperature: 0.7,
          max_tokens: 800,
        });

        replyContent = followUp.choices[0]?.message?.content ?? replyContent ?? "Your issue has been logged and resolved.";
        break; // handle only first relevant tool call
      }
    }

    // Fallback if no content at all
    if (!replyContent || !replyContent.trim()) {
      replyContent = "Thanks for reaching out! Could you share a bit more detail so I can help you better?";
    }

    // Fallback ticketing: if AI didn't auto-resolve but offered escalation or KB was empty, create pending_human ticket
    // This ensures dashboard always shows tickets even when not auto-resolved (fixes "not storing in tickets")
    if (!ticketCreated) {
      const needsHuman = /escalate|human agent|don't have|do not have|not able|share.*details/i.test(replyContent);
      const isFirstExchange = body.messages.length <= 2; // first user message + possible welcome
      // Check if ticket already exists for this conversation to avoid duplicates per turn
      const { data: existingTicket } = await admin.from("tickets").select("id").eq("conversation_id", conversationId).limit(1).maybeSingle();
      if (!existingTicket && (needsHuman || ragChunks.length === 0 || isFirstExchange)) {
        const fallbackTitle = userContent.slice(0, 80).trim() || "Customer inquiry";
        // crude priority: login/auth = 4, payment =5, general=2
        let priority = 3;
        if (/login|password|auth|unable.*log/i.test(userContent)) priority = 4;
        if (/payment|refund|billing|charge/i.test(userContent)) priority = 5;
        if (/hi|hello|hey|thanks/i.test(userContent) && userContent.length < 20) priority = 1;
        const { data: newTicket, error: ticketErr } = await admin
          .from("tickets")
          .insert({
            conversation_id: conversationId,
            organization_id: organizationId,
            title: fallbackTitle.length < 3 ? "Support request" : fallbackTitle,
            ai_summary: replyContent.slice(0, 500),
            priority_level: priority,
            status: "pending_human",
          })
          .select("id")
          .single();
        if (!ticketErr && newTicket) {
          ticketCreated = { ticketId: newTicket.id, title: fallbackTitle };
          // mark conversation as needing human
          await admin.from("conversations").update({ status: "escalated" }).eq("id", conversationId);
        }
      }
    }

    // Persist AI message
    await admin.from("messages").insert({
      conversation_id: conversationId,
      role: "ai",
      content: replyContent,
      attachment_url: null,
    });

    // Keep conversation updated_at fresh
    await admin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

    return NextResponse.json(
      {
        success: true,
        reply: replyContent,
        conversationId,
        sessionId,
        organizationId,
        ticketCreated,
        sources: ragChunks.map((c) => ({ url_source: c.url_source, similarity: c.similarity })),
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("[POST /api/chat]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      usage: "POST /api/chat with { messages: [{role, content}], organizationId?, sessionId?, attachment_url? }",
      tool: "log_resolved_ticket → tickets (auto_resolved)",
    },
    { headers: corsHeaders }
  );
}
