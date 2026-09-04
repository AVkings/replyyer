import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhook } from "@/lib/razorpay";
import { createServiceClient } from "@/lib/supabase";
import { grantCredits } from "@/lib/credits";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || "";
  if (secret && signature) {
    const ok = verifyRazorpayWebhook(raw, signature, secret);
    if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 400 });
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

    if (businessId && credits > 0) {
      const supa = createServiceClient();
      const { data: biz } = await supa.from("businesses").select("id").eq("id", businessId).maybeSingle();
      if (biz) {
        await grantCredits(businessId, credits, `razorpay:${payment?.id}`);
        // increment coupon usage if coupon was used
        const coupon = notes.coupon as string | undefined;
        if (coupon) {
          const { data: c } = await supa.from("coupons").select("id, uses").eq("code", coupon).maybeSingle();
          if (c) await supa.from("coupons").update({ uses: (c.uses || 0) + 1 }).eq("id", c.id);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
