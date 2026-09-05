import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { fetchRazorpayPayment, grantForPaidOrder } from "@/lib/payments";

/**
 * Immediate post-checkout verification.
 * Called by the billing page handler with Razorpay's response.
 * Verifies signature, fetches payment from Razorpay, grants credits now
 * (webhook remains as backup; both paths are idempotent).
 */
export async function POST(req: NextRequest) {
  const supaAuth = await createServerSupabase();
  const {
    data: { user },
  } = await supaAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, business_id } = await req.json().catch(() => ({}));
  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !business_id) {
    return NextResponse.json({ error: "payment, order, signature and business_id required" }, { status: 400 });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  if (!keySecret) return NextResponse.json({ error: "payments not configured" }, { status: 500 });

  // 1. Verify signature: HMAC(order_id|payment_id)
  const expected = crypto.createHmac("sha256", keySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
  if (expected !== razorpay_signature) {
    return NextResponse.json({ error: "invalid payment signature" }, { status: 400 });
  }

  const service = createServiceClient();
  // 2. Business must belong to caller
  const { data: biz } = await service.from("businesses").select("id").eq("id", business_id).eq("owner_user_id", user.id).maybeSingle();
  if (!biz) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 3. Resolve expected credits from OUR orders table (never trust client)
  const { data: ord } = await service
    .from("orders")
    .select("business_id, credits, pack_id, coupon, discount_paise, amount_paise, status")
    .eq("razorpay_order_id", razorpay_order_id)
    .maybeSingle() as { data: { business_id: string; credits: number; pack_id: string; coupon: string | null; discount_paise: number; amount_paise: number; status: string } | null };

  if (!ord || ord.business_id !== business_id) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }
  if (ord.status === "paid") {
    const { getBalance } = await import("@/lib/credits");
    const balance = await getBalance(business_id).catch(() => undefined);
    return NextResponse.json({ ok: true, already: true, balance });
  }

  // 4. Fetch authoritative payment from Razorpay
  let payment: Record<string, unknown>;
  try {
    payment = await fetchRazorpayPayment(razorpay_payment_id);
  } catch (e) {
    console.error("verify: fetch payment failed", e);
    return NextResponse.json({ error: "could not verify payment with Razorpay" }, { status: 502 });
  }
  const status = String(payment.status || "");
  if (status !== "captured" && status !== "authorized") {
    return NextResponse.json({ error: `payment not captured (status: ${status})` }, { status: 400 });
  }
  if (String((payment as Record<string, unknown>).order_id || "") !== razorpay_order_id) {
    return NextResponse.json({ error: "order mismatch" }, { status: 400 });
  }
  const paidAmount = Number(payment.amount || 0);

  try {
    const res = await grantForPaidOrder({
      businessId: business_id,
      credits: ord.credits,
      packId: ord.pack_id,
      discountPaise: ord.discount_paise || 0,
      paidAmountPaise: paidAmount,
      paymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      coupon: (ord.coupon || "").toUpperCase() || undefined,
    });
    if (!res.granted && res.skipped && res.skipped !== "already credited") {
      return NextResponse.json({ error: `verification failed: ${res.skipped}` }, { status: 400 });
    }
    return NextResponse.json({ ok: true, balance: res.balance, already: res.skipped === "already credited" });
  } catch (e) {
    console.error("verify: grant failed", e);
    return NextResponse.json({ error: "grant failed, webhook will retry" }, { status: 500 });
  }
}
