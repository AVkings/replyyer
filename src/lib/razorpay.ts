import Razorpay from "razorpay";
import crypto from "crypto";

export function getRazorpay() {
  const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error("Razorpay keys missing");
  return new Razorpay({ key_id, key_secret });
}

export function verifyRazorpayWebhook(body: string, signature: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}

export const CREDIT_PACKS = [
  { id: "pack_500", credits: 500, amountPaise: 49900, label: "500 credits — ₹499" },
  { id: "pack_2500", credits: 2500, amountPaise: 199900, label: "2,500 credits — ₹1,999" },
  { id: "pack_10000", credits: 10000, amountPaise: 699900, label: "10,000 credits — ₹6,999" },
] as const;
