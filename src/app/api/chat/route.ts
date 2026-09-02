import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getKiraClient, KIRA_MODEL } from "@/lib/kira/client";
import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/knowledge/retrieve";
import { logResolvedTicketTool, handleLogResolvedTicket, parseToolArgs } from "@/lib/chat/tools";
import type OpenAI from "openai";

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
  organization_id?: string;
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
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function extractEmail(text: string): string | null {
  const m = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0].toLowerCase() : null;
}

function isGreetingOnly(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length > 40) return false;
  return /^(hi|hey|hello|hey there|hola|hai|yo|sup|howdy|good\s*(morning|afternoon|evening)|thanks|thank you|ok|okay|bye|goodbye)[\s!.]*$/i.test(t);
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
  const { data: created, error: createErr } = await admin.from("organizations").insert({ name: "Demo Organization", domain: "demo.repllyer.com" }).select("id").single();
  if (createErr || !created) throw new Error(`No org and auto-create failed: ${createErr?.message}`);
  return created.id;
}

async function ensureConversation(opts: { organizationId: string; sessionId: string; customerEmail?: string; }): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin.from("conversations").select("id, customer_email").eq("organization_id", opts.organizationId).eq("session_id", opts.sessionId).single();
  if (existing) {
    // If we now have an email and existing has no email, update it
    if (opts.customerEmail && !existing.customer_email) {
      await admin.from("conversations").update({ customer_email: opts.customerEmail }).eq("id", existing.id);
    }
    return existing.id;
  }
  const { data: created, error } = await admin.from("conversations").insert({ organization_id: opts.organizationId, session_id: opts.sessionId, customer_email: opts.customerEmail ?? null, status: "active" }).select("id").single();
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
    let customerEmail = body.customerEmail ?? body.customer_email ?? undefined;
    // Try to extract email from any user message if not explicitly provided
    if (!customerEmail) {
      for (const m of body.messages) {
        if (m.role === "user") {
          const e = extractEmail(m.content ?? "");
          if (e) { customerEmail = e; break; }
        }
      }
      // Also check last message's attachment? no
    }

    const organizationId = await ensureOrganizationId(rawOrg);
    const conversationId = await ensureConversation({ organizationId, sessionId, customerEmail });
    const admin = createSupabaseAdminClient();

    // If we found an email in this turn and conversation had no email, ensure it's saved
    const foundEmailThisTurn = extractEmail(lastUserMsg.content ?? "");
    if (foundEmailThisTurn) {
      const { data: conv } = await admin.from("conversations").select("customer_email").eq("id", conversationId).single();
      if (conv && !conv.customer_email) {
        await admin.from("conversations").update({ customer_email: foundEmailThisTurn }).eq("id", conversationId);
      }
    }

    const userContent = lastUserMsg.content ?? "";
    const userAttachment = (lastUserMsg.attachment_url ?? attachmentUrl) as string | null;
    await admin.from("messages").insert({ conversation_id: conversationId, role: "user", content: userContent, attachment_url: userAttachment && /^https?:\/\//.test(userAttachment) ? userAttachment : null });

    // If conversation is escalated (human takeover), don't let AI reply — keep status escalated and return a placeholder
    const { data: convStatus } = await admin.from("conversations").select("status, customer_email").eq("id", conversationId).single();
    const isEscalated = convStatus?.status === "escalated";
    const needsEmail = !convStatus?.customer_email && !customerEmail && !foundEmailThisTurn;

    let ragChunks: Awaited<ReturnType<typeof retrieveRelevantChunks>> = [];
    let contextBlock = "No relevant knowledge base context found.";
    try {
      ragChunks = await retrieveRelevantChunks(userContent, organizationId, { threshold: 0.3, count: 5 });
      contextBlock = formatChunksForPrompt(ragChunks);
    } catch (e) { console.warn("[chat] RAG retrieve failed:", e); }

    // Strict system prompt: email first, no fake auto-resolve for greetings, continue chat if not solved
    const systemPrompt = `You are Repllyer — an autonomous AI customer support agent.
You help customers using ONLY the knowledge base context provided. Be concise, friendly, and accurate.

KNOWLEDGE BASE CONTEXT:
${contextBlock}

CRITICAL RULES:
- TASK 1 — EMAIL CAPTURE (HIGHEST PRIORITY): At the start of EVERY new conversation, you MUST ask for the customer's email and DO NOT proceed with troubleshooting until you have it. Be persistent but friendly. If customer_email is already known: ${convStatus?.customer_email ?? "unknown"}, acknowledge it. If missing, ask: "Could you share your email so I can assist and follow up?" — and do NOT mark anything as resolved until email is captured.
- If the context does not contain the answer, say you don't have that information and offer to escalate to a human. Do NOT hallucinate.
- Use context verbatim when relevant; cite source URL if you use it.
- If the user uploaded an attachment (image/file link), acknowledge it and consider it in your answer.
- AUTO-RESOLVE TOOL: Only call log_resolved_ticket when you are 100% certain the user's real issue (not a greeting like "hi", "hey", "hello", "thanks") is fully solved with a concrete solution from the context AND the user has not asked a follow-up. For greetings, short thanks, or vague "hi", NEVER call the tool — just ask how you can help and ask for email if missing. The chat must CONTINUE if not solved.
- Priority: 1=trivial (greetings), 2=low, 3=medium, 4=high, 5=critical (security/data loss/outage).
- Keep tone warm, modern, helpful. If escalated, AI should not reply — human will take over.`;

    // If escalated, we still want to persist user message but return a human-takeover notice instead of AI
    let replyContent: string | null = null;
    let ticketCreated: { ticketId: string; title: string } | null = null;

    if (isEscalated) {
      replyContent = "A human agent has taken over this conversation. They will reply shortly — please wait.";
    } else {
      // For pure greetings, short-circuit: don't even call LLM for tool, just ask for email/issue
      const greetingOnly = isGreetingOnly(userContent);
      if (greetingOnly && needsEmail) {
        replyContent = "Hi there! 👋 Could you share your email so I can help you properly? And let me know what issue you're facing — I'm here to help!";
      } else {
        const kiraMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "system", content: systemPrompt }];
        for (const m of body.messages) {
          if (m.role === "system") continue;
          let content = m.content ?? "";
          const att = (m as ChatMessage).attachment_url;
          if (att && /^https?:\/\//.test(att)) content += `\n\n[User attached file: ${att}]`;
          if (m === lastUserMsg && attachmentUrl && !content.includes(attachmentUrl)) content += `\n\n[User attached file: ${attachmentUrl}]`;
          kiraMessages.push({ role: m.role as "user" | "assistant", content });
        }
        const kira = getKiraClient();
        const first = await kira.chat.completions.create({ model: KIRA_MODEL, messages: kiraMessages, tools: [logResolvedTicketTool], tool_choice: "auto", temperature: 0.7, max_tokens: 900 });
        const choice = first.choices[0];
        const toolCalls = choice.message.tool_calls;
        replyContent = choice.message.content ?? "";
        // Guard tool calls: never auto-resolve greetings
        if (toolCalls && toolCalls.length > 0) {
          const isGreetingUser = isGreetingOnly(userContent);
          if (isGreetingUser) {
            console.warn("[chat] blocked auto_resolve for greeting:", userContent);
            // Ignore tool call for greetings
          } else {
            for (const tc of toolCalls) {
              if (tc.type !== "function" || tc.function.name !== "log_resolved_ticket") continue;
              const parsed = parseToolArgs(tc.function.arguments);
              if (!parsed) { console.warn("[chat] invalid tool args:", tc.function.arguments); continue; }
              // Extra guard: issue_title must not be greeting
              if (isGreetingOnly(parsed.issue_title) || parsed.issue_title.length < 5) {
                console.warn("[chat] blocked auto_resolve for vague title:", parsed.issue_title);
                continue;
              }
              const res = await handleLogResolvedTicket(parsed, { organizationId, conversationId });
              if (res.success) ticketCreated = { ticketId: res.ticketId, title: parsed.issue_title };
              else console.error("[chat] ticket insert failed:", res.error);
              const toolMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
                ...kiraMessages,
                { role: "assistant", content: choice.message.content ?? null, tool_calls: toolCalls as any } as OpenAI.Chat.ChatCompletionMessageParam,
                { role: "tool", tool_call_id: tc.id, content: res.success ? `Ticket logged successfully: ${res.ticketId} for "${parsed.issue_title}"` : `Ticket log failed: ${res.error}` } as unknown as OpenAI.Chat.ChatCompletionMessageParam,
              ];
              const followUp = await kira.chat.completions.create({ model: KIRA_MODEL, messages: toolMessages, temperature: 0.7, max_tokens: 800 });
              replyContent = followUp.choices[0]?.message?.content ?? replyContent ?? "Your issue has been logged and resolved.";
              break;
            }
          }
        }
      }
    }

    if (!replyContent || !replyContent.trim()) replyContent = "Thanks for reaching out! Could you share your email and a bit more detail so I can help you better?";

    // Fallback ticketing: only if not greeting and not already ticketed
    if (!ticketCreated) {
      const isGreeting = isGreetingOnly(userContent);
      if (!isGreeting) {
        const needsHuman = /escalate|human agent|don't have|do not have|not able|share.*details|email/i.test(replyContent) || ragChunks.length === 0;
        const { data: existingTicket } = await admin.from("tickets").select("id").eq("conversation_id", conversationId).limit(1).maybeSingle();
        if (!existingTicket && needsHuman) {
          const fallbackTitle = userContent.slice(0, 80).trim() || "Customer inquiry";
          let priority = 3;
          if (/login|password|auth|unable.*log/i.test(userContent)) priority = 4;
          if (/payment|refund|billing|charge/i.test(userContent)) priority = 5;
          const { data: newTicket } = await admin.from("tickets").insert({ conversation_id: conversationId, organization_id: organizationId, title: fallbackTitle.length < 3 ? "Support request" : fallbackTitle, ai_summary: replyContent.slice(0, 500), priority_level: priority, status: "pending_human" }).select("id").single();
          if (newTicket) {
            ticketCreated = { ticketId: newTicket.id, title: fallbackTitle };
            await admin.from("conversations").update({ status: "escalated" }).eq("id", conversationId);
          }
        }
      }
    }

    await admin.from("messages").insert({ conversation_id: conversationId, role: "ai", content: replyContent, attachment_url: null });
    await admin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

    return NextResponse.json({ success: true, reply: replyContent, conversationId, sessionId, organizationId, ticketCreated, sources: ragChunks.map((c) => ({ url_source: c.url_source, similarity: c.similarity })) }, { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("[POST /api/chat]", err);
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : String(err) }, { status: 500, headers: corsHeaders });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, usage: "POST /api/chat with { messages: [{role, content}], organizationId?, sessionId?, attachment_url? }", tool: "log_resolved_ticket → tickets (auto_resolved)" }, { headers: corsHeaders });
}
