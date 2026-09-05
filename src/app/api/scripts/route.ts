import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { slugify, SCRIPT_CODE_MAX } from "@/lib/scripts";
import { z } from "zod";

const Create = z.object({
  business_id: z.string().uuid(),
  name: z.string().min(2).max(80),
  description: z.string().max(1000).default(""),
  trigger_keywords: z.string().max(500).default(""),
  required_params: z.array(z.string()).max(10).default(["email"]),
  action_type: z.enum(["code", "webhook"]).default("code"),
  action_config: z.record(z.string(), z.unknown()).default({}),
});

/** Shared env-var validation: client-owned secrets live inside the script, never in server env. */
export function validateEnv(env: unknown): string | null {
  if (env === undefined) return null;
  if (!env || typeof env !== "object" || Array.isArray(env)) return "env must be an object of KEY: value";
  const entries = Object.entries(env as Record<string, unknown>);
  if (entries.length > 20) return "max 20 env vars per script";
  for (const [k, v] of entries) {
    if (!/^[A-Z0-9_]{1,64}$/.test(k)) return `bad env key "${k}" (use A-Z, 0-9, _ only)`;
    if (typeof v !== "string" || !v.trim() || v.length > 2000) return `bad value for "${k}" (1–2000 chars)`;
  }
  return null;
}

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
  // Never send secret VALUES back to the browser — only key names + whether Gmail is saved
  const masked = ((data as Record<string, unknown>[]) || []).map((s) => {
    const c = ((s.action_config as Record<string, unknown>) || {}) as Record<string, unknown>;
    const { gmail_app_password, env, ...rest } = c;
    const envKeys = env && typeof env === "object" ? Object.keys(env as Record<string, unknown>) : [];
    return { ...s, action_config: rest, env_keys: envKeys, gmail_app_password_set: !!gmail_app_password };
  });
  return NextResponse.json({ scripts: masked });
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

  // Validate client code scripts (+ per-script env vars, stored inside the script only)
  const cfg = action_config as Record<string, unknown>;
  if (action_type === "code") {
    const code = String(cfg.code || "");
    const language = String(cfg.language || "javascript");
    if (language !== "javascript") return NextResponse.json({ error: "only javascript code scripts are supported (Python can't run on serverless)" }, { status: 400 });
    if (!code.trim()) return NextResponse.json({ error: "code is required for code scripts" }, { status: 400 });
    if (code.length > SCRIPT_CODE_MAX) return NextResponse.json({ error: `code too long (max ${SCRIPT_CODE_MAX} chars)` }, { status: 400 });
  }
  const envErr = validateEnv(cfg.env);
  if (envErr) return NextResponse.json({ error: envErr }, { status: 400 });
  if (cfg.env) {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(cfg.env as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) clean[k] = v.trim();
    }
    cfg.env = clean;
  }
  if (cfg.gmail_user !== undefined && cfg.gmail_user !== "") {
    if (typeof cfg.gmail_user !== "string" || !cfg.gmail_user.includes("@") || cfg.gmail_user.length > 200) {
      return NextResponse.json({ error: "gmail_user must be a valid email address" }, { status: 400 });
    }
    cfg.gmail_user = cfg.gmail_user.trim();
  }
  if (cfg.gmail_app_password !== undefined && cfg.gmail_app_password !== "") {
    if (typeof cfg.gmail_app_password !== "string" || cfg.gmail_app_password.length > 500) {
      return NextResponse.json({ error: "gmail_app_password too long" }, { status: 400 });
    }
    cfg.gmail_app_password = cfg.gmail_app_password.trim().replace(/\s+/g, "");
  }

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
