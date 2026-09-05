import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhook } from "@/lib/razorpay";
import { createServiceClient } from "@/lib/supabase";
import { grantForPaidOrder } from "@/lib/payments";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || "";
  // Strict: signature REQUIRED. No bypass.
  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 500 });
  if (!signature || !verifyRazorpayWebhook(raw, signature, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let evt: Record<string, unknown>;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const event = evt.event as string;
  if (event === "payment.captured" || event === "order.paid" || event === "payment.authorized") {
    const payload = evt.payload as Record<string, unknown>;
    const payment = (payload?.payment as Record<string, unknown>)?.entity as Record<string, unknown> | undefined;
    const orderEntity = (payload?.order as Record<string, unknown>)?.entity as Record<string, unknown> | undefined;
    let notes = (payment?.notes as Record<string, string>) || {};
    const paymentId = String(payment?.id || "");
    const razorpayOrderId = String(payment?.order_id || orderEntity?.id || "");
    const paidAmount = Number(payment?.amount || 0); // paise

    const supa = createServiceClient();

    // Fallback: if payment notes are empty (frontend overrode notes), use our orders table
    if ((!notes.business_id || !notes.credits) && razorpayOrderId) {
      try {
        const { data: ord } = await supa
          .from("orders")
          .select("business_id, credits, pack_id, coupon, discount_paise")
          .eq("razorpay_order_id", razorpayOrderId)
          .maybeSingle();
        if (ord) {
          notes = {
            business_id: (ord as { business_id: string }).business_id,
            credits: String((ord as { credits: number }).credits),
            pack_id: (ord as { pack_id: string }).pack_id,
            coupon: (ord as { coupon: string | null }).coupon || "",
            discount: String((ord as { discount_paise: number }).discount_paise || 0),
          };
        }
      } catch (e) {
        console.error("webhook: orders fallback failed (migration missing?)", e instanceof Error ? e.message : e);
      }
    }

    const businessId = notes.business_id as string | undefined;
    const credits = parseInt(String(notes.credits || "0"), 10) || 0;
    const packId = (notes.pack_id as string | undefined) || "";
    const discount = Math.max(0, parseInt(String(notes.discount || "0"), 10) || 0);
    const coupon = (notes.coupon as string | undefined)?.toUpperCase() || undefined;

    if (!businessId || !credits || !paymentId) {
      return NextResponse.json({ ok: true, skipped: "invalid payload" });
    }

    try {
      const res = await grantForPaidOrder({
        businessId,
        credits,
        packId,
        discountPaise: discount,
        paidAmountPaise: paidAmount,
        paymentId,
        razorpayOrderId: razorpayOrderId || undefined,
        coupon,
      });
      return NextResponse.json({ ok: true, ...res });
    } catch (e) {
      console.error("webhook grant failed", e);
      return NextResponse.json({ ok: true, skipped: "grant error, will retry" });
    }
  }

  return NextResponse.json({ ok: true });
}
