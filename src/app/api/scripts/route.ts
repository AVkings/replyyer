import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { slugify } from "@/lib/scripts";
import { z } from "zod";

const Create = z.object({
  business_id: z.string().uuid(),
  name: z.string().min(2).max(80),
  description: z.string().max(1000).default(""),
  trigger_keywords: z.string().max(500).default(""),
  required_params: z.array(z.string()).max(10).default(["email"]),
  action_type: z.enum(["send_email", "webhook", "mock"]).default("send_email"),
  action_config: z.record(z.string(), z.unknown()).default({}),
});

export async function GET(req: NextRequest) {
  const supaAuth = await createServerSupabase();
  const { data: { user } } = await supaAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const businessId = new URL(req.url).searchParams.get("business_id");
  if (!businessId) return NextResponse.json({ error: "business_id required" }, { status: 400 });
  const service = createServiceClient();
  const { data: biz } = await service.from("businesses").select("id").eq("id", businessId).eq("owner_user_id", user.id).maybeSingle();
  if (!biz) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data } = await service.from("business_scripts").select("*").eq("business_id", businessId).order("created_at", { ascending: false });
  return NextResponse.json({ scripts: data || [] });
}

export async function POST(req: NextRequest) {
  const supaAuth = await createServerSupabase();
  const { data: { user } } = await supaAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Create.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { business_id, name, description, trigger_keywords, required_params, action_type, action_config } = parsed.data;

  const service = createServiceClient();
  const { data: biz } = await service.from("businesses").select("id").eq("id", business_id).eq("owner_user_id", user.id).maybeSingle();
  if (!biz) return NextResponse.json({ error: "not found" }, { status: 404 });

  const slug = slugify(name);
  const cleanParams = [...new Set(required_params.map((p) => p.trim().toLowerCase()).filter((p) => ["email", "phone", "name", "order_id", "username", "account_id"].includes(p)))];
  if (!cleanParams.length) return NextResponse.json({ error: "at least one required param" }, { status: 400 });

  const { data, error } = await service
    .from("business_scripts")
    .insert({ business_id, name: name.trim(), slug, description, trigger_keywords, required_params: cleanParams, action_type, action_config })
    .select("*")
    .single();
  if (error) {
    if (error.message.includes("duplicate") || error.message.includes("unique")) {
      return NextResponse.json({ error: "a script with a similar name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ script: data });
}
