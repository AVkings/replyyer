import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhook } from "@/lib/razorpay";
import { createServiceClient } from "@/lib/supabase";
import { grantCredits } from "@/lib/credits";

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
  if (event === "payment.captured" || event === "order.paid") {
    const payload = evt.payload as Record<string, unknown>;
    const payment = (payload?.payment as Record<string, unknown>)?.entity as Record<string, unknown> | undefined;
    const notes = (payment?.notes as Record<string, string>) || {};
    const businessId = notes.business_id as string | undefined;
    const creditsStr = notes.credits as string | undefined;
    const credits = creditsStr ? parseInt(creditsStr, 10) : 0;
    const paymentId = String(payment?.id || "");
    const paidAmount = Number((payment as Record<string, unknown>)?.amount || 0); // paise

    if (!businessId || !credits || credits <= 0 || credits > 100000 || !paymentId) {
      return NextResponse.json({ ok: true, skipped: "invalid payload" });
    }

    // Verify amount matches a real pack (minus coupon) — prevents forged notes
    const { CREDIT_PACKS } = await import("@/lib/razorpay");
    const packId = notes.pack_id as string | undefined;
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack || pack.credits !== credits) {
      return NextResponse.json({ ok: true, skipped: "pack mismatch" });
    }
    const discount = Math.max(0, parseInt(String(notes.discount || "0"), 10) || 0);
    const expectedMin = Math.max(100, pack.amountPaise - discount);
    // Allow small tolerance (fees/rounding) but never accept underpay
    if (paidAmount < expectedMin) {
      return NextResponse.json({ ok: true, skipped: "underpaid" });
    }

    const supa = createServiceClient();
    const { data: biz } = await supa.from("businesses").select("id").eq("id", businessId).maybeSingle();
    if (!biz) return NextResponse.json({ ok: true, skipped: "no business" });

    // Idempotent grant — same paymentId can never credit twice
    try {
      await grantCredits(businessId, credits, `razorpay:${paymentId}`);
    } catch (e) {
      // unique violation means already credited — safe to ignore
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("duplicate") && !msg.includes("unique")) throw e;
    }
    const coupon = notes.coupon as string | undefined;
    if (coupon) {
      // Atomic-ish increment with max_uses guard
      const { data: c } = await supa
        .from("coupons")
        .select("id, uses, max_uses")
        .eq("code", coupon)
        .maybeSingle();
      if (c && (!c.max_uses || (c.uses || 0) < c.max_uses)) {
        await supa.from("coupons").update({ uses: (c.uses || 0) + 1 }).eq("id", c.id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
