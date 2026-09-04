import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiKey, extractApiKey } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase";
import { getBalance } from "@/lib/credits";

const Body = z.object({
  name: z.string().min(1).max(100).optional().or(z.literal("")),
  email: z.string().email().max(200).optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const rawKey = extractApiKey(req);
  let bodyUnknown: unknown = {};
  try {
    bodyUnknown = await req.clone().json();
  } catch {}
  // api_key may be in body fallback
  const rawKeyFromBody = (bodyUnknown as Record<string, unknown>)?.api_key as string | undefined;
  const effectiveKey = rawKey || rawKeyFromBody || "";

  let body: unknown = bodyUnknown;
  if (body && typeof body === "object" && "api_key" in (body as Record<string, unknown>)) {
    const { api_key: _k, ...rest } = body as Record<string, unknown>;
    body = rest;
  }

  const keyData = await verifyApiKey(effectiveKey);
  if (!keyData) return NextResponse.json({ error: "invalid api key" }, { status: 401 });

  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const balance = await getBalance(keyData.business_id);
  if (balance <= 0) return NextResponse.json({ error: "credits exhausted", credits_remaining: 0 }, { status: 402 });

  const supa = createServiceClient();
  // Allow guest session without email — bot will retrieve later
  const nameRaw = parsed.data.name?.trim() || "Guest";
  const emailRaw = parsed.data.email?.trim() || "";

  let endUserId: string;
  if (emailRaw) {
    const { data: existing } = await supa.from("end_users").select("id").eq("business_id", keyData.business_id).eq("email", emailRaw).maybeSingle();
    if (existing) {
      endUserId = existing.id;
      if (nameRaw !== "Guest") await supa.from("end_users").update({ name: nameRaw }).eq("id", endUserId);
    } else {
      const { data, error } = await supa.from("end_users").insert({ business_id: keyData.business_id, name: nameRaw, email: emailRaw }).select("id").single();
      if (error || !data) return NextResponse.json({ error: error?.message }, { status: 500 });
      endUserId = data.id;
    }
  } else {
    // Create anonymous end_user with temp email so FK works; bot will update later when it extracts email
    const tempEmail = `guest_${Date.now()}@repllyer.local`;
    const { data, error } = await supa.from("end_users").insert({ business_id: keyData.business_id, name: nameRaw, email: tempEmail }).select("id").single();
    if (error || !data) return NextResponse.json({ error: error?.message }, { status: 500 });
    endUserId = data.id;
  }

  const { data: session, error: sessErr } = await supa
    .from("sessions")
    .insert({
      business_id: keyData.business_id,
      end_user_id: endUserId,
      status: "active",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .select("id, expires_at")
    .single();

  if (sessErr || !session) return NextResponse.json({ error: sessErr?.message }, { status: 500 });

  return NextResponse.json({
    session_id: session.id,
    expires_at: session.expires_at,
    credits_remaining: balance,
    guest: !emailRaw,
  });
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true });
}
