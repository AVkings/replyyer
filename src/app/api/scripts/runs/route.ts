import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";

/**
 * Usage history: when each script ran, with what params, what happened, cost.
 * Params may contain visitor emails — only the owning business can read these.
 */
export async function GET(req: NextRequest) {
  const supaAuth = await createServerSupabase();
  const {
    data: { user },
  } = await supaAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const businessId = q.get("business_id");
  const scriptId = q.get("script_id");
  const limit = Math.min(100, Math.max(1, parseInt(q.get("limit") || "30", 10) || 30));
  if (!businessId) return NextResponse.json({ error: "business_id required" }, { status: 400 });

  const service = createServiceClient();
  const { data: biz } = await service.from("businesses").select("id").eq("id", businessId).eq("owner_user_id", user.id).maybeSingle();
  if (!biz) return NextResponse.json({ error: "not found" }, { status: 404 });

  let query = service
    .from("script_runs")
    .select("id, script_id, session_id, params, result, credits_charged, created_at, business_scripts(name, slug)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (scriptId) query = query.eq("script_id", scriptId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Per-script totals for the dashboard header
  const { data: all } = await service.from("script_runs").select("script_id, credits_charged").eq("business_id", businessId).limit(1000);
  const stats: Record<string, { runs: number; credits: number }> = {};
  for (const r of ((all as { script_id: string; credits_charged: number }[]) || [])) {
    stats[r.script_id] = stats[r.script_id] || { runs: 0, credits: 0 };
    stats[r.script_id].runs += 1;
    stats[r.script_id].credits += r.credits_charged || 0;
  }

  return NextResponse.json({ runs: data || [], stats });
}
