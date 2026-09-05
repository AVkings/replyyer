import { createServiceClient } from "./supabase";
import { consumeCreditsExact } from "./credits";
import vm from "node:vm";

export const SCRIPT_RUN_COST = 30;
export const SCRIPT_CODE_MAX = 10000;
export const SCRIPT_RUN_TIMEOUT_MS = 8000;

export type ScriptActionType = "code" | "webhook" | "send_email" | "mock";
// NOTE: only "code" + "webhook" can be created now (DB constraint 005).
// send_email/mock branches below exist only to finish runs of legacy rows.

export type ScriptRow = {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description: string;
  trigger_keywords: string;
  required_params: string[];
  action_type: ScriptActionType;
  action_config: Record<string, unknown>;
  is_active: boolean;
};

export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || `script-${Date.now()}`;
}

export type OutgoingMail = { to: string; subject: string; body: string };

/**
 * Deliver queued emails via Gmail SMTP using THIS SCRIPT's own credentials:
 *   gmail_user         = the client's Gmail address (stored in the script's settings)
 *   gmail_app_password = that account's Google App Password (NOT the login password)
 * Each business stores its own creds inside its own script — nothing shared,
 * nothing in server env, never logged, never returned to the browser.
 * Without creds, emails are logged-only (safe default).
 */
export async function flushOutbox(
  emails: OutgoingMail[],
  creds?: { user?: string; pass?: string }
): Promise<(OutgoingMail & { sent: boolean; note?: string; error?: string })[]> {
  const user = (creds?.user || "").trim();
  const pass = (creds?.pass || "").trim();
  if (!user || !pass) {
    return emails.map((e) => ({ ...e, sent: false, note: "logged only; save Gmail address + App Password in this script's settings for real delivery" }));
  }
  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  const out: (OutgoingMail & { sent: boolean; note?: string; error?: string })[] = [];
  for (const e of emails) {
    try {
      await transporter.sendMail({ from: user, to: e.to, subject: e.subject, text: e.body });
      out.push({ ...e, sent: true });
    } catch (err) {
      out.push({ ...e, sent: false, error: err instanceof Error ? err.message.slice(0, 300) : "send failed" });
    }
  }
  return out;
}

type CodeExecResult = { result: Record<string, unknown>; emails: { to: string; subject: string; body: string }[]; logs: string[] };

/**
 * Run client JS code in a sandbox.
 * Available variables: params, contact {name,email,phone}, business {id,name},
 * script {slug,name}, env {YOUR_KEY: "value"} (the script's own variables).
 * Helpers: sendEmail(to, subject, body), log(...). Set global `result = {...}` to return data.
 * No require/process/fetch — use the `webhook` action type for external HTTP.
 */
async function runClientCode(opts: {
  code: string;
  params: Record<string, string>;
  contact: { name: string; email: string; phone: string };
  business: { id: string; name: string };
  script: { slug: string; name: string };
  env: Record<string, string>;
}): Promise<CodeExecResult> {
  const { code, params, contact, business, script, env } = opts;
  if (!code.trim()) throw new Error("code is empty");
  if (code.length > SCRIPT_CODE_MAX) throw new Error(`code too long (max ${SCRIPT_CODE_MAX} chars)`);

  const emails: CodeExecResult["emails"] = [];
  const logs: string[] = [];

  const sandbox: Record<string, unknown> = {
    params: { ...params },
    contact: { ...contact },
    business: { ...business },
    script: { ...script },
    env: { ...env },
    result: {} as Record<string, unknown>,
    log: (...args: unknown[]) => {
      logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ").slice(0, 1000));
    },
    sendEmail: (to: unknown, subject: unknown, body: unknown) => {
      const t = String(to || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) throw new Error(`sendEmail: invalid to address "${t}"`);
      const mail = { to: t, subject: String(subject || `Your ${script.name} request`), body: String(body || "") };
      emails.push(mail);
      return { sent: true, ...mail, note: "logged; connect SMTP/Resend for real delivery" };
    },
  };
  // Convenience alias used in docs
  (sandbox as Record<string, unknown>).sendMail = sandbox.sendEmail;

  vm.createContext(sandbox);
  const wrapped = `(async () => {\n${code}\n})()`;
  const promise = vm.runInContext(wrapped, sandbox, { timeout: 3000 }) as Promise<unknown>;
  await Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("script timed out (8s limit)")), SCRIPT_RUN_TIMEOUT_MS)),
  ]);

  const result = (sandbox.result && typeof sandbox.result === "object" ? sandbox.result : {}) as Record<string, unknown>;
  return { result, emails, logs: logs.slice(0, 20) };
}

/** Execute a script: charge 30cr, perform action, log run. */
export async function runScript(opts: {
  businessId: string;
  businessName?: string;
  script: ScriptRow;
  sessionId: string;
  params: Record<string, string>;
  contact?: { name: string; email: string; phone: string };
}): Promise<{ ok: boolean; result: Record<string, unknown>; error?: string }> {
  const { businessId, businessName, script, sessionId, params, contact } = opts;
  const supa = createServiceClient();

  // Validate required params present
  const missing = (script.required_params || []).filter((p) => !params[p] || !String(params[p]).trim());
  if (missing.length) return { ok: false, result: {}, error: `missing params: ${missing.join(", ")}` };

  // Charge 30 credits atomically BEFORE running
  const charged = await consumeCreditsExact(businessId, SCRIPT_RUN_COST, `script_run:${script.slug}:${sessionId}:${Date.now()}`).catch(() => ({ ok: false }) as const);
  if (!charged.ok) return { ok: false, result: {}, error: "insufficient credits for script run (30 required)" };

  let result: Record<string, unknown> = { action: script.action_type };
  try {
    if (script.action_type === "code") {
      const cfg = script.action_config as { code?: string; language?: string; gmail_user?: string; gmail_app_password?: string; env?: Record<string, string> };
      if ((cfg.language || "javascript") !== "javascript") throw new Error("only javascript code scripts are supported on serverless (Python not available) — paste JS using the same variables");
      // Secrets come from the script's OWN env vars (client-owned). Legacy gmail_* fields still work as fallback.
      const env = { ...((cfg.env as Record<string, string>) || {}) };
      const exec = await runClientCode({
        code: String(cfg.code || ""),
        params,
        contact: contact || { name: "", email: params.email || "", phone: params.phone || "" },
        business: { id: businessId, name: businessName || "" },
        script: { slug: script.slug, name: script.name },
        env,
      });
      const sent = await flushOutbox(exec.emails, {
        user: env.GMAIL_USER || cfg.gmail_user,
        pass: env.GMAIL_APP_PASSWORD || cfg.gmail_app_password,
      });
      result = { action: "code", language: "javascript", ...exec.result, emails: sent, logs: exec.logs };
    } else if (script.action_type === "send_email") {
      // Legacy (pre-005). Kept so old rows finish cleanly; new ones can't be created.
      const cfg = script.action_config as { to?: string; subject?: string; template?: string; gmail_user?: string; gmail_app_password?: string; env?: Record<string, string> };
      const to = params.email || (cfg.to as string) || "";
      const subject = (cfg.subject as string) || `Your ${script.name} request`;
      const template = (cfg.template as string) || `Hi, your request "${script.name}" was processed.`;
      const env = ((cfg.env as Record<string, string>) || {});
      const delivered = await flushOutbox([{ to, subject, body: template }], { user: env.GMAIL_USER || cfg.gmail_user, pass: env.GMAIL_APP_PASSWORD || cfg.gmail_app_password });
      result = { action: "send_email", ...delivered[0] };
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

  // Audit log
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

export const CODE_TEMPLATE = `// Client script: variables available —
// params  (e.g. params.email, params.phone, params.name)
// contact ({name, email, phone}), business ({id, name}), script ({slug, name})
// Helpers: sendEmail(to, subject, body), log(...)
// Set global result = {...} to return data to the chat.

if (!params.email) throw new Error("email required");

sendEmail(
  params.email,
  "Reset your password",
  "Hi " + (contact.name || "there") + ",\\n\\nClick here to reset your password. This link expires in 30 minutes."
);

result = { emailed: params.email, action: "password-reset-sent" };`;
