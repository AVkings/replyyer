/**
 * Tool Calling: log_resolved_ticket
 * When AI determines the user's issue is fully resolved, it calls this tool.
 * Handler inserts into `tickets` with status auto_resolved.
 */

import type OpenAI from "openai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * OpenAI tool definition for Kira hy3 (OpenAI-compatible)
 * Pass this in `tools` to createChatCompletion / chat.completions.create
 */
export const logResolvedTicketTool: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "log_resolved_ticket",
    description:
      "Call this ONLY when the user's issue is fully resolved and no human follow-up is needed. Logs a ticket with auto_resolved status for analytics and audit.",
    parameters: {
      type: "object",
      properties: {
        issue_title: {
          type: "string",
          description: "Short, clear title for the resolved issue (3-100 chars). Example: 'Password reset not working in Chrome'",
        },
        ai_summary: {
          type: "string",
          description:
            "1-3 sentence summary of what the user asked and how you resolved it. Be specific about the solution provided.",
        },
        priority_level: {
          type: "integer",
          description: "Priority of the issue that was resolved, 1 (low) to 5 (critical). Estimate based on urgency/impact.",
          minimum: 1,
          maximum: 5,
        },
      },
      required: ["issue_title", "ai_summary", "priority_level"],
      additionalProperties: false,
    },
  },
};

export type LogResolvedTicketArgs = {
  issue_title: string;
  ai_summary: string;
  priority_level: number;
};

export type TicketInsertResult =
  | { success: true; ticketId: string }
  | { success: false; error: string };

/**
 * Validates and inserts a resolved ticket.
 * Called server-side after detecting a tool_call in the AI response.
 */
export async function handleLogResolvedTicket(
  args: LogResolvedTicketArgs,
  opts: { organizationId: string; conversationId: string }
): Promise<TicketInsertResult> {
  const { organizationId, conversationId } = opts;

  // Validate args
  if (!args.issue_title || typeof args.issue_title !== "string" || args.issue_title.trim().length < 3) {
    return { success: false, error: "issue_title must be at least 3 characters" };
  }
  if (!args.ai_summary || typeof args.ai_summary !== "string" || args.ai_summary.trim().length < 5) {
    return { success: false, error: "ai_summary must be at least 5 characters" };
  }
  let priority = Number(args.priority_level);
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
    // Coerce and clamp rather than fail outright
    priority = Math.min(5, Math.max(1, Math.round(priority) || 3));
  }

  if (!organizationId || !conversationId) {
    return { success: false, error: "organizationId and conversationId are required" };
  }

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(organizationId) || !uuidRe.test(conversationId)) {
    return { success: false, error: "Invalid UUID for organizationId or conversationId" };
  }

  const admin = createSupabaseAdminClient();

  // Verify conversation belongs to org (defense)
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .select("id, organization_id")
    .eq("id", conversationId)
    .single();

  if (convErr || !conv) {
    return { success: false, error: `Conversation not found: ${convErr?.message ?? "unknown"}` };
  }
  if (conv.organization_id !== organizationId) {
    return { success: false, error: "Conversation does not belong to this organization" };
  }

  const { data, error } = await admin
    .from("tickets")
    .insert({
      conversation_id: conversationId,
      organization_id: organizationId,
      title: args.issue_title.trim().slice(0, 200),
      ai_summary: args.ai_summary.trim().slice(0, 2000),
      priority_level: priority,
      status: "auto_resolved",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to insert ticket" };
  }

  // Optionally mark conversation as resolved
  await admin
    .from("conversations")
    .update({ status: "resolved" })
    .eq("id", conversationId);

  return { success: true, ticketId: data.id };
}

/**
 * Helper: safely parse tool call arguments (handles stringified JSON)
 */
export function parseToolArgs(raw: string | object): LogResolvedTicketArgs | null {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (
      typeof obj.issue_title === "string" &&
      typeof obj.ai_summary === "string" &&
      typeof obj.priority_level !== "undefined"
    ) {
      return {
        issue_title: obj.issue_title,
        ai_summary: obj.ai_summary,
        priority_level: Number(obj.priority_level),
      };
    }
    return null;
  } catch {
    return null;
  }
}
