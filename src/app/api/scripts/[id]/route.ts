import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { SCRIPT_CODE_MAX } from "@/lib/scripts";
import { z } from "zod";

const Patch = z.object({
  business_id: z.string().uuid(),
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(1000).optional(),
  trigger_keywords: z.string().max(500).optional(),
  required_params: z.array(z.string()).max(10).optional(),
  action_type: z.enum(["code", "webhook"]).optional(),
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
  if (parsed.data.action_config) {
    const incoming = parsed.data.action_config as Record<string, unknown> & { env?: Record<string, unknown>; env_remove?: string[] };
    // Merge with stored config so empty secret fields keep the saved values
    const { data: existing } = await service
      .from("business_scripts")
      .select("action_type, action_config")
      .eq("id", id)
      .eq("business_id", parsed.data.business_id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    const prev = ((existing as { action_config: Record<string, unknown> }).action_config || {}) as Record<string, unknown>;
    const prevEnv = (prev.env && typeof prev.env === "object" ? prev.env : {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...prev, ...incoming };
    delete (merged as Record<string, unknown>).env_remove;
    // Generic env vars: non-empty = set/update, "" or missing = keep, env_remove[] = delete
    const nextEnv: Record<string, string> = {};
    for (const [k, v] of Object.entries(prevEnv)) if (typeof v === "string") nextEnv[k] = v;
    if (incoming.env && typeof incoming.env === "object") {
      for (const [k, v] of Object.entries(incoming.env as Record<string, unknown>)) {
        if (!/^[A-Z0-9_]{1,64}$/.test(k)) return NextResponse.json({ error: `bad env key "${k}"` }, { status: 400 });
        if (typeof v === "string" && v.trim()) {
          if (v.length > 2000) return NextResponse.json({ error: `bad value for "${k}"` }, { status: 400 });
          nextEnv[k] = v.trim();
        }
        // empty string = keep existing (already in nextEnv)
      }
      if (Object.keys(nextEnv).length > 20) return NextResponse.json({ error: "max 20 env vars per script" }, { status: 400 });
    }
    for (const k of Array.isArray(incoming.env_remove) ? incoming.env_remove : []) delete nextEnv[k];
    merged.env = nextEnv;
    if (incoming.gmail_app_password === "" || incoming.gmail_app_password === undefined) {
      if (prev.gmail_app_password) merged.gmail_app_password = prev.gmail_app_password;
      else delete merged.gmail_app_password;
    } else {
      const pw = String(merged.gmail_app_password || "").trim().replace(/\s+/g, "");
      if (pw.length > 500) return NextResponse.json({ error: "gmail_app_password too long" }, { status: 400 });
      merged.gmail_app_password = pw;
    }
    if (merged.gmail_user !== undefined && merged.gmail_user !== "") {
      if (typeof merged.gmail_user !== "string" || !merged.gmail_user.includes("@")) {
        return NextResponse.json({ error: "gmail_user must be a valid email address" }, { status: 400 });
      }
      merged.gmail_user = merged.gmail_user.trim();
    }
    const effType = parsed.data.action_type || (existing as { action_type: string }).action_type;
    if (effType === "code") {
      const code = String(merged.code || "");
      if (!code.trim()) return NextResponse.json({ error: "code is required for code scripts" }, { status: 400 });
      if (code.length > SCRIPT_CODE_MAX) return NextResponse.json({ error: `code too long (max ${SCRIPT_CODE_MAX} chars)` }, { status: 400 });
      if (merged.language && merged.language !== "javascript") return NextResponse.json({ error: "only javascript supported" }, { status: 400 });
    }
    patch.action_config = merged;
  }
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
