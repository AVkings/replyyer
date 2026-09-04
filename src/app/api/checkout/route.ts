import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { getRazorpay, CREDIT_PACKS } from "@/lib/razorpay";

export async function POST(req: NextRequest) {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { business_id, pack_id, coupon } = await req.json().catch(() => ({}));
  if (!business_id || !pack_id) return NextResponse.json({ error: "business_id + pack_id required" }, { status: 400 });

  const pack = CREDIT_PACKS.find((p) => p.id === pack_id);
  if (!pack) return NextResponse.json({ error: "unknown pack" }, { status: 400 });

  const service = createServiceClient();
  const { data: biz } = await service.from("businesses").select("id").eq("id", business_id).eq("owner_user_id", user.id).maybeSingle();
  if (!biz) return NextResponse.json({ error: "not found" }, { status: 404 });

  let amount: number = pack.amountPaise;
  let appliedCoupon: string | null = null;
  let discount = 0;

  if (coupon) {
    const code = String(coupon).trim().toUpperCase();
    const { data: c } = await service.from("coupons").select("id, code, percent, amount_off_paise, max_uses, uses, active, expires_at").eq("code", code).maybeSingle() as { data: { id: string; code: string; percent: number | null; amount_off_paise: number | null; max_uses: number | null; uses: number; active: boolean; expires_at: string | null } | null };
    if (!c) return NextResponse.json({ error: "invalid coupon" }, { status: 400 });
    if (!c.active) return NextResponse.json({ error: "coupon inactive" }, { status: 400 });
    if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "coupon expired" }, { status: 400 });
    if (c.max_uses && c.uses >= c.max_uses) return NextResponse.json({ error: "coupon fully redeemed" }, { status: 400 });
    if (c.amount_off_paise != null) discount = c.amount_off_paise;
    else if (c.percent != null) discount = Math.round((amount * c.percent) / 100);
    else discount = 0;
    amount = amount - discount;
    if (amount < 100) amount = 100; // min ₹1
    appliedCoupon = c.code;
  }

  const rzp = getRazorpay();
  const order = await rzp.orders.create({
    amount,
    currency: "INR",
    receipt: `${business_id.slice(0, 8)}_${pack_id}_${Date.now()}`,
    notes: { business_id, credits: String(pack.credits), pack_id, coupon: appliedCoupon || "", discount: String(discount) },
  });

  return NextResponse.json({ order, key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, applied_coupon: appliedCoupon, discount, amount });
}
