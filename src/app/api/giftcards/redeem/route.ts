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
  const { data: gc } = await supa.from("giftcards").select("id, credits, redeemed").eq("code", normalized).maybeSingle();
  if (!gc) return NextResponse.json({ error: "invalid giftcard" }, { status: 404 });
  if (gc.redeemed) return NextResponse.json({ error: "already redeemed" }, { status: 400 });

  // mark redeemed + grant credits atomically (best effort)
  const { error: updErr } = await supa.from("giftcards").update({ redeemed: true, redeemed_by: business_id }).eq("id", gc.id).eq("redeemed", false);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // check if actually updated (race)
  const { data: after } = await supa.from("giftcards").select("redeemed").eq("id", gc.id).single();
  if (!after?.redeemed) return NextResponse.json({ error: "redeem failed" }, { status: 500 });

  const bal = await grantCredits(business_id, gc.credits, `giftcard:${normalized}`);
  return NextResponse.json({ ok: true, credits: gc.credits, balance: bal });
}
