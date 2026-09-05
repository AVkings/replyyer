import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { grantCredits } from "@/lib/credits";

export async function POST(req: NextRequest) {
  const supaAuth = await createServerSupabase();
  const {
    data: { user },
  } = await supaAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { business_id, code } = await req.json().catch(() => ({}));
  if (!business_id || !code) return NextResponse.json({ error: "business_id + code required" }, { status: 400 });

  const supa = createServiceClient();
  const { data: biz } = await supa.from("businesses").select("id").eq("id", business_id).eq("owner_user_id", user.id).maybeSingle();
  if (!biz) return NextResponse.json({ error: "not found" }, { status: 404 });

  const normalized = String(code).trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,40}$/.test(normalized)) return NextResponse.json({ error: "invalid giftcard" }, { status: 404 });

  // Atomic claim: only one request can flip redeemed=false -> true
  const { data: claimed, error: updErr } = await supa
    .from("giftcards")
    .update({ redeemed: true, redeemed_by: business_id })
    .eq("code", normalized)
    .eq("redeemed", false)
    .select("id, credits")
    .maybeSingle();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  if (!claimed) {
    // Either invalid or already redeemed — don't reveal which for brute-force resistance
    const { data: exists } = await supa.from("giftcards").select("id").eq("code", normalized).maybeSingle();
    if (!exists) return NextResponse.json({ error: "invalid giftcard" }, { status: 404 });
    return NextResponse.json({ error: "already redeemed" }, { status: 400 });
  }
  if (!claimed.credits || claimed.credits <= 0 || claimed.credits > 100000) {
    return NextResponse.json({ error: "invalid giftcard value" }, { status: 400 });
  }

  const bal = await grantCredits(business_id, claimed.credits, `giftcard:${normalized}`);
  return NextResponse.json({ ok: true, credits: claimed.credits, balance: bal });
}
