import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// POST { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, organizationId }
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return NextResponse.json({ error: "Razorpay not configured" }, { status: 500, headers: corsHeaders });

  const body = await req.json().catch(() => null) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    plan?: string;
    organizationId?: string;
  } | null;

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, organizationId } = body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing razorpay ids" }, { status: 400, headers: corsHeaders });
  }

  const expected = crypto.createHmac("sha256", secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");

  if (expected !== razorpay_signature) {
    return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400, headers: corsHeaders });
  }

  // Verified — update subscription
  const limits: Record<string, number> = { basic_300: 300, basic_600: 600, payg: 999999 };
  const limit = limits[plan || ""] ?? 300;

  if (organizationId) {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRe.test(organizationId)) {
      const admin = createSupabaseAdminClient();
      const planName = plan === "basic_600" ? "basic_600" : plan === "payg" ? "payg" : "basic_300";
      await admin.from("organization_subscriptions").upsert(
        {
          organization_id: organizationId,
          plan: planName,
          conversation_limit: limit,
          conversations_used: 0,
          period_start: new Date().toISOString(),
          razorpay_order_id,
          razorpay_payment_id,
        },
        { onConflict: "organization_id" }
      );
    }
  }

  return NextResponse.json({ success: true, verified: true, plan, limit }, { headers: corsHeaders });
}
