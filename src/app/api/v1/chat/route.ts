import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiKey, extractApiKey } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase";
import { consumeCredit, getBalance } from "@/lib/credits";
import { classifyAndAnswer } from "@/lib/kiraai";

const Body = z.object({
  session_id: z.string().uuid(),
  message: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  const rawKey = extractApiKey(req);
  const keyData = await verifyApiKey(rawKey || "");
  if (!keyData) return NextResponse.json({ error: "invalid api_key, use x-api-key header" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { session_id, message } = parsed.data;
  const supa = createServiceClient();

  // Validate session belongs to business and is active
  const { data: session, error: sessErr } = await supa
    .from("sessions")
    .select("id, business_id, end_user_id, status, expires_at")
    .eq("id", session_id)
    .maybeSingle();

  if (sessErr || !session) return NextResponse.json({ error: "session not found" }, { status: 404 });
  if (session.business_id !== keyData.business_id) return NextResponse.json({ error: "session mismatch" }, { status: 403 });
  if (session.status !== "active" || new Date(session.expires_at).getTime() < Date.now()) {
    await supa.from("sessions").update({ status: "expired" }).eq("id", session_id);
    return NextResponse.json({ error: "session expired, re-init" }, { status: 410 });
  }

  // Extend expiry on activity
  await supa.from("sessions").update({ expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() }).eq("id", session_id);

  // Credit check + consume 1
  const balBefore = await getBalance(keyData.business_id);
  if (balBefore <= 0) return NextResponse.json({ error: "credits exhausted", credits_remaining: 0 }, { status: 402 });
  const consumed = await consumeCredit(keyData.business_id, "chat");
  const credits_remaining = consumed.ok ? consumed.balance : balBefore - 1;

  // Save user message
  await supa.from("messages").insert({
    session_id,
    business_id: keyData.business_id,
    role: "user",
    content: message,
  });

  // Try to retrieve name/email from message if end_user is still guest (no real email)
  const { data: eu } = await supa.from("end_users").select("name, email").eq("id", session.end_user_id).maybeSingle();
  const isGuest = !eu || eu.email.endsWith("@repllyer.local") || eu.name === "Guest";
  if (isGuest) {
    const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const nameHint = message.match(/(?:my name is|i am|i'm)\s+([A-Za-z ]{2,30})/i);
    const updates: Record<string, string> = {};
    if (emailMatch) updates.email = emailMatch[0].toLowerCase();
    if (nameHint) updates.name = nameHint[1].trim();
    // Heuristic: if message is just "John" and guest, treat as name
    if (!emailMatch && !nameHint && message.trim().split(" ").length <= 3 && message.length <= 30 && /^[A-Za-z ]+$/.test(message.trim())) {
      // don't auto-overwrite if already non-guest, but heuristic asks AI to confirm
    }
    if (Object.keys(updates).length) {
      await supa.from("end_users").update(updates).eq("id", session.end_user_id);
    }
  }

  // Load business info + KB
  const { data: biz } = await supa.from("businesses").select("description, name").eq("id", keyData.business_id).single();
  const { data: kbFiles } = await supa.from("kb_files").select("extracted_text").eq("business_id", keyData.business_id).limit(10);
  const { data: kbTextRows } = await supa.from("knowledge_bases").select("raw_text").eq("business_id", keyData.business_id).order("created_at", { ascending: false }).limit(1);
  const kbText = [...(kbTextRows?.map((r) => r.raw_text) || []), ...(kbFiles?.map((f) => f.extracted_text).filter(Boolean) as string[] || [])].join("\n\n---\n\n");

  // Load recent history
  const { data: historyRows } = await supa
    .from("messages")
    .select("role, content")
    .eq("session_id", session_id)
    .order("created_at", { ascending: true })
    .limit(12);
  const history = (historyRows || [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-10)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const resultRaw = await classifyAndAnswer({
    businessInfo: biz ? `${biz.name}\n${biz.description || ""}` : "",
    kbText,
    history,
    userMessage: message,
  });
  // kiraai may return extracted_email/name per new prompt
  const result: typeof resultRaw & { extracted_email?: string; extracted_name?: string } = resultRaw as unknown as typeof resultRaw & { extracted_email?: string; extracted_name?: string };
  // Prefer AI-extracted contact if we are still guest
  const aiEmail = (result.extracted_email || "").trim();
  const aiName = (result.extracted_name || "").trim();
  if (aiEmail || aiName) {
    const upd: Record<string, string> = {};
    if (aiEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(aiEmail)) upd.email = aiEmail.toLowerCase();
    if (aiName && aiName.length >= 2 && aiName.length <= 60) upd.name = aiName;
    if (Object.keys(upd).length) await supa.from("end_users").update(upd).eq("id", session.end_user_id);
  }

  // Decide human handoff: not solvable OR confidence < 0.72 OR urgent with low confidence
  const needsHuman = !result.solvable || result.confidence < 0.72;

  if (needsHuman) {
    const { data: ticket } = await supa
      .from("human_tickets")
      .insert({
        session_id,
        business_id: keyData.business_id,
        priority: result.priority,
        topic: result.topic,
        status: "open",
        ai_confidence: result.confidence,
        ai_reason: result.reason,
      })
      .select("id")
      .single();

    // Also save assistant placeholder
    await supa.from("messages").insert({
      session_id,
      business_id: keyData.business_id,
      role: "assistant",
      content: result.answer,
    });

    return NextResponse.json({
      status: "human_required" as const,
      ticket_id: ticket?.id,
      priority: result.priority,
      topic: result.topic,
      answer: result.answer,
      confidence: result.confidence,
      credits_remaining,
    });
  }

  // Auto-resolved
  await supa.from("messages").insert({
    session_id,
    business_id: keyData.business_id,
    role: "assistant",
    content: result.answer,
  });

  return NextResponse.json({
    status: "resolved" as const,
    answer: result.answer,
    priority: result.priority,
    topic: result.topic,
    confidence: result.confidence,
    credits_remaining,
  });
}
