import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("organizationId") || req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("chatbox_configs").select("config, updated_at").eq("organization_id", orgId).maybeSingle();
  return NextResponse.json({ config: data?.config ?? null });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { organizationId?: string; config?: Record<string, unknown> } | null;
  const orgId = body?.organizationId?.trim();
  const config = body?.config;
  if (!orgId || !config) return NextResponse.json({ error: "organizationId and config required" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  // Verify ownership
  const { data: org } = await admin.from("organizations").select("id").eq("id", orgId).eq("owner_id", user.id).maybeSingle();
  if (!org) {
    const { data: anyOrg } = await admin.from("organizations").select("id").eq("id", orgId).limit(1).maybeSingle();
    if (!anyOrg) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { error } = await admin.from("chatbox_configs").upsert({ organization_id: orgId, config }, { onConflict: "organization_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
