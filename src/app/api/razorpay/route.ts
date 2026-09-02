import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// POST { plan: "basic_300" | "basic_600" | "payg", organizationId }
export async function POST(req: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return NextResponse.json({ error: "Razorpay not configured" }, { status: 500, headers: corsHeaders });

  const body = await req.json().catch(() => null) as { plan?: string; organizationId?: string } | null;
  const plan = body?.plan as string | undefined;
  const orgId = body?.organizationId;

  const pricing: Record<string, { amount: number; limit: number; label: string }> = {
    basic_300: { amount: 300, limit: 300, label: "Basic 300" }, // $3 = 300 paise? actually 300 INR? Use 300*100
    basic_600: { amount: 500, limit: 600, label: "Pro 600" }, // $5 = 500
    payg: { amount: 100, limit: 999999, label: "Pay as you go" },
  };

  if (!plan || !pricing[plan]) return NextResponse.json({ error: "Invalid plan. Use basic_300, basic_600, payg" }, { status: 400, headers: corsHeaders });

  const { amount, label } = pricing[plan];

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

  const order = await razorpay.orders.create({
    amount: amount * 100, // paise
    currency: "USD",
    receipt: `${orgId || "anon"}_${plan}_${Date.now()}`,
    notes: { plan, organizationId: orgId || "", label },
  });

  return NextResponse.json({ success: true, orderId: order.id, amount: order.amount, currency: order.currency, keyId, plan, limit: pricing[plan].limit }, { headers: corsHeaders });
}

export async function GET() {
  return NextResponse.json({ plans: { free: { limit: 180, price: 0 }, basic_300: { limit: 300, price: 3 }, basic_600: { limit: 600, price: 5 }, payg: { limit: "unlimited", price: "pay as you go" } } }, { headers: corsHeaders });
}
