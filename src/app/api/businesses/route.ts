import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { hashKey } from "@/lib/api-auth";
import crypto from "crypto";

export async function GET() {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const service = createServiceClient();
  const { data } = await service.from("businesses").select("*").eq("owner_user_id", user.id).order("created_at", { ascending: false });
  return NextResponse.json({ businesses: data || [] });
}

export async function POST(req: NextRequest) {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const description = String(body.description || "").slice(0, 5000);
  const domain = String(body.domain || "").slice(0, 200);
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const service = createServiceClient();
  // Enforce 100 credits per business after the first one (first is free with 180)
  const { count: existingCount } = await service.from("businesses").select("id", { count: "exact", head: true }).eq("owner_user_id", user.id);
  if ((existingCount || 0) >= 1) {
    const { data: firstBiz } = await service.from("businesses").select("id").eq("owner_user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!firstBiz) return NextResponse.json({ error: "no business to charge" }, { status: 400 });
    const { getBalance } = await import("@/lib/credits");
    const bal = await getBalance(firstBiz.id);
    if (bal < 100) return NextResponse.json({ error: "Need 100 credits to create another business", credits_required: 100, balance: bal }, { status: 402 });
    const { error: chargeErr } = await service.from("credits_ledger").insert({ business_id: firstBiz.id, delta: -100, reason: "business_create", balance_after: bal - 100 });
    if (chargeErr) return NextResponse.json({ error: chargeErr.message }, { status: 500 });
  }

  const { data: biz, error } = await service
    .from("businesses")
    .insert({ owner_user_id: user.id, name, description, domain })
    .select("id, name")
    .single();
  if (error || !biz) return NextResponse.json({ error: error?.message }, { status: 500 });

  // auto-generate api key
  const raw = `rply_live_${crypto.randomBytes(24).toString("hex")}`;
  const hash = hashKey(raw);
  await service.from("api_keys").insert({ business_id: biz.id, key_hash: hash, prefix: raw.slice(0, 12) });

  return NextResponse.json({ business: biz, api_key: raw, warning: "Save this key now — it won't be shown again." });
}
