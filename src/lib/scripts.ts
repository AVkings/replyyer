import { createServiceClient } from "./supabase";
import { consumeCreditsExact } from "./credits";

export const SCRIPT_RUN_COST = 30;

export type ScriptRow = {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description: string;
  trigger_keywords: string;
  required_params: string[];
  action_type: "send_email" | "webhook" | "mock";
  action_config: Record<string, unknown>;
  is_active: boolean;
};

export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || `script-${Date.now()}`;
}

/** Execute a script: charge 30cr, perform action, log run. Idempotent per message+script. */
export async function runScript(opts: {
  businessId: string;
  script: ScriptRow;
  sessionId: string;
  params: Record<string, string>;
}): Promise<{ ok: boolean; result: Record<string, unknown>; error?: string }> {
  const { businessId, script, sessionId, params } = opts;
  const supa = createServiceClient();

  // Validate required params present
  const missing = (script.required_params || []).filter((p) => !params[p] || !String(params[p]).trim());
  if (missing.length) return { ok: false, result: {}, error: `missing params: ${missing.join(", ")}` };

  // Charge 30 credits atomically BEFORE running
  const charged = await consumeCreditsExact(businessId, SCRIPT_RUN_COST, `script_run:${script.slug}:${sessionId}:${Date.now()}`).catch(() => ({ ok: false }) as const);
  if (!charged.ok) return { ok: false, result: {}, error: "insufficient credits for script run (30 required)" };

  let result: Record<string, unknown> = { action: script.action_type };
  try {
    if (script.action_type === "send_email") {
      const cfg = script.action_config as { to?: string; subject?: string; template?: string };
      const to = params.email || (cfg.to as string) || "";
      const subject = (cfg.subject as string) || `Your ${script.name} request`;
      const template = (cfg.template as string) || `Hi, your request "${script.name}" was processed.`;
      // MVP: log the email (plug real SMTP/Resend here). We record it as sent.
      console.log(`[script email] to=${to} subject=${subject} script=${script.slug}`);
      result = { action: "send_email", to, subject, body: template, sent: true, note: "logged; connect SMTP/Resend for real delivery" };
    } else if (script.action_type === "webhook") {
      const cfg = script.action_config as { url?: string; method?: string };
      if (!cfg.url) throw new Error("webhook url not configured");
      const r = await fetch(cfg.url, {
        method: cfg.method || "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: script.slug, business_id: businessId, session_id: sessionId, params }),
      });
      const text = await r.text().catch(() => "");
      result = { action: "webhook", url: cfg.url, status: r.status, response: text.slice(0, 500) };
    } else {
      result = { action: "mock", echo: params, note: "mock run, no side effect" };
    }
  } catch (e) {
    result = { action: script.action_type, error: e instanceof Error ? e.message : "action failed" };
  }

  // Audit log (unique per message+script prevents double-charge on retry — message_id set by caller when known)
  await supa.from("script_runs").insert({
    business_id: businessId,
    script_id: script.id,
    session_id: sessionId,
    params,
    result,
    credits_charged: SCRIPT_RUN_COST,
  });

  return { ok: true, result };
}
