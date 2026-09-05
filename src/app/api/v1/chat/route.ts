import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiKey, extractApiKey } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase";
import { consumeCredit, getBalance } from "@/lib/credits";
import { classifyAndAnswer } from "@/lib/kiraai";
import { corsHeaders } from "@/lib/cors";

const Body = z.object({
  session_id: z.string().uuid(),
  message: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  const rawKey = extractApiKey(req);
  const keyData = await verifyApiKey(rawKey || "");
  if (!keyData) return NextResponse.json({ error: "invalid api_key, use x-api-key header" }, { status: 401, headers: corsHeaders() });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers: corsHeaders() });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: corsHeaders() });

  const { session_id, message } = parsed.data;
  const supa = createServiceClient();

  // Validate session belongs to business and is active
  const { data: session, error: sessErr } = await supa
    .from("sessions")
    .select("id, business_id, end_user_id, status, expires_at")
    .eq("id", session_id)
    .maybeSingle();

  if (sessErr || !session) return NextResponse.json({ error: "session not found" }, { status: 404, headers: corsHeaders() });
  if (session.business_id !== keyData.business_id) return NextResponse.json({ error: "session mismatch" }, { status: 403, headers: corsHeaders() });
  if (session.status !== "active" || new Date(session.expires_at).getTime() < Date.now()) {
    await supa.from("sessions").update({ status: "expired" }).eq("id", session_id);
    return NextResponse.json({ error: "session expired, re-init" }, { status: 410, headers: corsHeaders() });
  }

  // Extend expiry on activity
  await supa.from("sessions").update({ expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() }).eq("id", session_id);

  // Credit check + consume 1
  const balBefore = await getBalance(keyData.business_id);
  if (balBefore <= 0) return NextResponse.json({ error: "credits exhausted", credits_remaining: 0 }, { status: 402, headers: corsHeaders() });
  const consumed = await consumeCredit(keyData.business_id, "chat");
  const credits_remaining = consumed.ok ? consumed.balance : balBefore - 1;

  // Save user message
  await supa.from("messages").insert({
    session_id,
    business_id: keyData.business_id,
    role: "user",
    content: message,
  });

  // Try to retrieve name/email/phone from message if end_user is still guest
  const { data: eu } = await supa.from("end_users").select("name, email, phone").eq("id", session.end_user_id).maybeSingle() as { data: { name: string; email: string; phone: string | null } | null };
  const isGuest = !eu || eu.email.endsWith("@repllyer.local") || eu.name === "Guest";
  const contactNow = { name: eu?.name || "", email: eu?.email || "", phone: eu?.phone || "" };
  if (isGuest) {
    const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const nameHint = message.match(/(?:my name is|i am|i'm|this is)\s+([A-Za-z ]{2,30})/i);
    const phoneMatch = message.match(/(?:\+?91[\s-]?)?[6-9]\d{9}/);
    const updates: Record<string, string> = {};
    if (emailMatch) updates.email = emailMatch[0].toLowerCase();
    if (nameHint) updates.name = nameHint[1].trim();
    if (phoneMatch) updates.phone = phoneMatch[0].replace(/[\s-]/g, "");
    if (Object.keys(updates).length) {
      await supa.from("end_users").update(updates).eq("id", session.end_user_id);
      Object.assign(contactNow, updates);
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

  // Load active scripts for this business (playground actions, 30cr/run)
  const { data: scriptRows } = await supa
    .from("business_scripts")
    .select("id, business_id, name, slug, description, trigger_keywords, required_params, action_type, action_config")
    .eq("business_id", keyData.business_id)
    .eq("is_active", true)
    .limit(20);

  const resultRaw = await classifyAndAnswer({
    businessInfo: biz ? `${biz.name}\n${biz.description || ""}` : "",
    kbText,
    history,
    userMessage: message,
    scripts: (scriptRows || []).map((s) => ({
      slug: (s as { slug: string }).slug,
      name: (s as { name: string }).name,
      description: (s as { description: string }).description || "",
      trigger_keywords: (s as { trigger_keywords: string }).trigger_keywords || "",
      required_params: ((s as { required_params: string[] }).required_params || []) as string[],
    })),
    contact: contactNow,
  });
  const result = resultRaw;
  // Prefer AI-extracted contact if we are still guest (email + phone + name)
  const aiEmail = (result.extracted_email || "").trim();
  const aiName = (result.extracted_name || "").trim();
  const aiPhone = (result.extracted_phone || "").trim().replace(/[\s-]/g, "");
  if (aiEmail || aiName || aiPhone) {
    const upd: Record<string, string> = {};
    if (aiEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(aiEmail)) upd.email = aiEmail.toLowerCase();
    if (aiName && aiName.length >= 2 && aiName.length <= 60) upd.name = aiName;
    if (aiPhone && /^(?:\+?91)?[6-9]\d{9}$/.test(aiPhone)) upd.phone = aiPhone;
    if (Object.keys(upd).length) {
      await supa.from("end_users").update(upd).eq("id", session.end_user_id);
      Object.assign(contactNow, upd);
    }
  }

  // Answer-first escalation: AI was instructed to try. Only escalate when it says unsolvable.
  const needsHuman = !result.solvable;

  // Script execution (30 credits): only when AI requested + contact/params verified
  let scriptRun: { slug: string; ok: boolean; result: Record<string, unknown> } | null = null;
  let scriptCreditsRemaining = credits_remaining;
  if (result.script_to_run) {
    const { runScript, SCRIPT_RUN_COST } = await import("@/lib/scripts");
    const match = (scriptRows || []).find((s) => (s as { slug: string }).slug === result.script_to_run);
    if (match) {
      const s = match as unknown as import("@/lib/scripts").ScriptRow;
      // Merge AI params with known contact so email/phone don't need re-asking
      const merged: Record<string, string> = { ...(result.script_params || {}) };
      if (!merged.email && contactNow.email && !contactNow.email.endsWith("@repllyer.local")) merged.email = contactNow.email;
      if (!merged.phone && contactNow.phone) merged.phone = contactNow.phone;
      if (!merged.name && contactNow.name && contactNow.name !== "Guest") merged.name = contactNow.name;
      const missing = (s.required_params || []).filter((p) => !merged[p]);
      if (missing.length === 0) {
        // Save user-visible message first so we have a message_id? runScript logs without message_id (nullable) — fine
        const exec = await runScript({ businessId: keyData.business_id, script: s, sessionId: session_id, params: merged });
        scriptCreditsRemaining = (await getBalance(keyData.business_id).catch(() => credits_remaining - SCRIPT_RUN_COST));
        scriptRun = { slug: s.slug, ok: exec.ok, result: exec.result };
      }
    }
  }

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

    const finalCredits = scriptRun ? scriptCreditsRemaining : credits_remaining;
    return NextResponse.json(
      {
        status: "human_required" as const,
        ticket_id: ticket?.id,
        priority: result.priority,
        topic: result.topic,
        answer: result.answer,
        confidence: result.confidence,
        credits_remaining: finalCredits,
        script_run: scriptRun,
      },
      { headers: corsHeaders() }
    );
  }

  // Auto-resolved (answer-first: AI tried, script may have run)
  await supa.from("messages").insert({
    session_id,
    business_id: keyData.business_id,
    role: "assistant",
    content: result.answer,
  });

  return NextResponse.json(
    {
      status: "resolved" as const,
      answer: result.answer,
      priority: result.priority,
      topic: result.topic,
      confidence: result.confidence,
      credits_remaining: scriptRun ? scriptCreditsRemaining : credits_remaining,
      script_run: scriptRun,
    },
    { headers: corsHeaders() }
  );
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true }, { headers: corsHeaders() });
}
