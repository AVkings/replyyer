import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { z } from "zod";

const Patch = z.object({
  business_id: z.string().uuid(),
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(1000).optional(),
  trigger_keywords: z.string().max(500).optional(),
  required_params: z.array(z.string()).max(10).optional(),
  action_type: z.enum(["send_email", "webhook", "mock"]).optional(),
  action_config: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

async function owned(businessId: string, userId: string) {
  const service = createServiceClient();
  const { data } = await service.from("businesses").select("id").eq("id", businessId).eq("owner_user_id", userId).maybeSingle();
  return !!data;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supaAuth = await createServerSupabase();
  const { data: { user } } = await supaAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Patch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (!(await owned(parsed.data.business_id, user.id))) return NextResponse.json({ error: "not found" }, { status: 404 });

  const service = createServiceClient();
  const patch: Record<string, unknown> = {};
  if (parsed.data.name) patch.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.trigger_keywords !== undefined) patch.trigger_keywords = parsed.data.trigger_keywords;
  if (parsed.data.required_params) {
    patch.required_params = [...new Set(parsed.data.required_params.map((p) => p.trim().toLowerCase()))].filter((p) => ["email", "phone", "name", "order_id", "username", "account_id"].includes(p));
  }
  if (parsed.data.action_type) patch.action_type = parsed.data.action_type;
  if (parsed.data.action_config) patch.action_config = parsed.data.action_config;
  if (parsed.data.is_active !== undefined) patch.is_active = parsed.data.is_active;

  const { data, error } = await service.from("business_scripts").update(patch).eq("id", id).eq("business_id", parsed.data.business_id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ script: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supaAuth = await createServerSupabase();
  const { data: { user } } = await supaAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const businessId = new URL(req.url).searchParams.get("business_id");
  if (!businessId) return NextResponse.json({ error: "business_id required" }, { status: 400 });
  if (!(await owned(businessId, user.id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const service = createServiceClient();
  const { error } = await service.from("business_scripts").delete().eq("id", id).eq("business_id", businessId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
