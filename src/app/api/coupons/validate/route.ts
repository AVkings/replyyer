import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { code } = await req.json().catch(() => ({}));
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  const supa = createServiceClient();
  const { data: c } = await supa.from("coupons").select("code, percent, amount_off_paise, max_uses, uses, active, expires_at").eq("code", String(code).trim().toUpperCase()).maybeSingle();
  if (!c) return NextResponse.json({ error: "invalid coupon" }, { status: 404 });
  if (!c.active) return NextResponse.json({ error: "inactive" }, { status: 400 });
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "expired" }, { status: 400 });
  if (c.max_uses && c.uses >= c.max_uses) return NextResponse.json({ error: "max uses reached" }, { status: 400 });
  return NextResponse.json(c);
}
