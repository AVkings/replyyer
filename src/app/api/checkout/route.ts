import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { getRazorpay, CREDIT_PACKS } from "@/lib/razorpay";
import { normalizeCredits, paygAmountPaise } from "@/lib/pricing";

export async function POST(req: NextRequest) {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { business_id, pack_id, coupon, custom_credits } = await req.json().catch(() => ({}));
  if (!business_id) return NextResponse.json({ error: "business_id required" }, { status: 400 });

  const service = createServiceClient();
  const { data: biz } = await service.from("businesses").select("id").eq("id", business_id).eq("owner_user_id", user.id).maybeSingle();
  if (!biz) return NextResponse.json({ error: "not found" }, { status: 404 });

  let credits: number;
  let amount: number;
  let resolvedPackId: string;

  if (pack_id === "payg" || pack_id === "custom" || custom_credits != null) {
    const n = normalizeCredits(custom_credits);
    if (n == null) return NextResponse.json({ error: `custom_credits must be an integer 100–50000` }, { status: 400 });
    credits = n;
    amount = paygAmountPaise(n);
    resolvedPackId = "payg";
  } else {
    if (!pack_id) return NextResponse.json({ error: "pack_id or custom_credits required" }, { status: 400 });
    const pack = CREDIT_PACKS.find((p) => p.id === pack_id);
    if (!pack) return NextResponse.json({ error: "unknown pack" }, { status: 400 });
    credits = pack.credits;
    amount = pack.amountPaise;
    resolvedPackId = pack.id;
  }

  let appliedCoupon: string | null = null;
  let discount = 0;

  if (coupon) {
    const code = String(coupon).trim().toUpperCase();
    if (!code) return NextResponse.json({ error: "invalid coupon" }, { status: 400 });
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
    // ALWAYS display/store uppercase
    appliedCoupon = c.code.toUpperCase();
  }

  const rzp = getRazorpay();
  const order = (await rzp.orders.create({
    amount,
    currency: "INR",
    receipt: `${business_id.slice(0, 8)}_${resolvedPackId}_${Date.now()}`,
    notes: { business_id, credits: String(credits), pack_id: resolvedPackId, coupon: appliedCoupon || "", discount: String(discount) },
  })) as unknown as { id: string; amount: number };

  // Persist order so webhook AND verify can both resolve credits even if notes differ
  let ordersPersisted = true;
  try {
    const { error: orderErr } = await service.from("orders").insert({
      business_id,
      razorpay_order_id: order.id,
      credits,
      amount_paise: amount,
      pack_id: resolvedPackId,
      coupon: appliedCoupon,
      discount_paise: discount,
      status: "created",
    });
    if (orderErr) {
      ordersPersisted = false;
      console.error("order persist failed", orderErr.message);
    }
  } catch (e) {
    ordersPersisted = false;
    console.error("order persist failed (orders table missing? run 003 migration)", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({
    order,
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    applied_coupon: appliedCoupon,
    discount,
    amount,
    credits,
    pack_id: resolvedPackId,
    orders_persisted: ordersPersisted,
  });
}
