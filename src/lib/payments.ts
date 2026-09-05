import { createServiceClient } from "./supabase";
import { getRazorpay, CREDIT_PACKS } from "./razorpay";
import { paygAmountPaise } from "./pricing";
import { grantCredits, getBalance } from "./credits";

export type GrantResult = { granted: boolean; balance?: number; skipped?: string };

/** Validate + grant credits for a paid order. Idempotent via razorpay:<paymentId> reason. */
export async function grantForPaidOrder(opts: {
  businessId: string;
  credits: number;
  packId: string;
  discountPaise: number;
  paidAmountPaise: number;
  paymentId: string;
  razorpayOrderId?: string;
  coupon?: string;
}): Promise<GrantResult> {
  const { businessId, credits, packId, discountPaise, paidAmountPaise, paymentId, razorpayOrderId, coupon } = opts;
  if (!businessId || !credits || credits <= 0 || credits > 100000 || !paymentId) {
    return { granted: false, skipped: "invalid payload" };
  }

  let expectedMin: number;
  if (packId === "payg" || packId === "custom") {
    expectedMin = Math.max(100, paygAmountPaise(credits) - Math.max(0, discountPaise));
  } else {
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack || pack.credits !== credits) return { granted: false, skipped: "pack mismatch" };
    expectedMin = Math.max(100, pack.amountPaise - Math.max(0, discountPaise));
  }
  if (paidAmountPaise < expectedMin) return { granted: false, skipped: "underpaid" };

  const supa = createServiceClient();
  const { data: biz } = await supa.from("businesses").select("id").eq("id", businessId).maybeSingle();
  if (!biz) return { granted: false, skipped: "no business" };

  try {
    const balance = await grantCredits(businessId, credits, `razorpay:${paymentId}`);
    if (razorpayOrderId) {
      await supa.from("orders").update({ status: "paid" }).eq("razorpay_order_id", razorpayOrderId);
    }
    if (coupon) {
      const { data: c } = await supa.from("coupons").select("id, uses, max_uses").eq("code", coupon).maybeSingle();
      if (c && (!c.max_uses || (c.uses || 0) < c.max_uses)) {
        await supa.from("coupons").update({ uses: (c.uses || 0) + 1 }).eq("id", c.id);
      }
    }
    return { granted: true, balance };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("already")) {
      const balance = await getBalance(businessId).catch(() => undefined);
      return { granted: false, skipped: "already credited", balance };
    }
    throw e;
  }
}

/** Fetch payment from Razorpay API (authoritative amount/notes). */
export async function fetchRazorpayPayment(paymentId: string) {
  const rzp = getRazorpay();
  const payment = (await rzp.payments.fetch(paymentId)) as unknown as Record<string, unknown>;
  return payment;
}
