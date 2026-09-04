import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { getBalance } from "@/lib/credits";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("business_id");
  if (!businessId) return NextResponse.json({ error: "business_id required" }, { status: 400 });
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const service = createServiceClient();
  const { data: biz } = await service.from("businesses").select("id").eq("id", businessId).eq("owner_user_id", user.id).maybeSingle();
  if (!biz) return NextResponse.json({ error: "not found" }, { status: 404 });
  const balance = await getBalance(businessId);
  const { data: ledger } = await service.from("credits_ledger").select("delta, reason, balance_after, created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(20);
  return NextResponse.json({ balance, ledger });
}
