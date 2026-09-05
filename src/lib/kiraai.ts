export type ScriptDef = {
  slug: string;
  name: string;
  description: string;
  trigger_keywords: string;
  required_params: string[];
};

type KiraaiClassifyResult = {
  priority: "urgent" | "high" | "medium" | "low";
  topic: string;
  solvable: boolean;
  confidence: number;
  answer: string;
  reason: string;
  extracted_email?: string;
  extracted_name?: string;
  extracted_phone?: string;
  script_to_run?: string;
  script_params?: Record<string, string>;
};

const BASE = process.env.KIRAAI_BASE_URL || process.env.KIRA_BASE_URL || "https://kiraai.vn/api/v1";
const KEY = (process.env.KIRAAI_API_KEY || process.env.KIRA_API_KEY || "") as string;
const MODEL = process.env.KIRAAI_MODEL || process.env.KIRA_MODEL || "gpt-4o-mini";

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

/**
 * JSON-mode chat with retry. Reasoning models can burn the token budget on
 * thinking and return EMPTY content (finish_reason=length) — that used to
 * crash JSON.parse and force every call into fallback. We retry once bigger,
 * strip markdown fences, and report ok:false instead of faking success.
 */
async function chatJson(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { temperature: number; maxTokens: number }
): Promise<{ ok: boolean; parsed: Record<string, unknown> | null }> {
  if (!KEY) return { ok: false, parsed: null };
  for (const max_tokens of [opts.maxTokens, opts.maxTokens + 2000]) {
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: MODEL, messages, temperature: opts.temperature, response_format: { type: "json_object" }, max_tokens }),
      });
      if (!res.ok) {
        console.error("kiraai error", res.status, (await res.text()).slice(0, 300));
        continue;
      }
      const json = await res.json();
      const text = stripFences(String(json.choices?.[0]?.message?.content || ""));
      if (!text) continue; // cut off before content — retry with bigger budget
      try {
        return { ok: true, parsed: JSON.parse(text) };
      } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            return { ok: true, parsed: JSON.parse(m[0]) };
          } catch {
            /* fallthrough to retry */
          }
        }
      }
    } catch (e) {
      console.error("kiraai fetch error", e instanceof Error ? e.message : e);
    }
  }
  return { ok: false, parsed: null };
}

function buildSystemPrompt(businessInfo: string, kbText: string, scripts: ScriptDef[], contact: { name: string; email: string; phone: string }) {
  const scriptsBlock = scripts.length
    ? scripts.map((s) => `- slug:"${s.slug}" name:"${s.name}" when:"${s.description} | triggers: ${s.trigger_keywords}" needs:[${s.required_params.join(",")}]`).join("\n")
    : "No custom scripts. Handle everything conversationally.";

  const known: string[] = [];
  if (contact.name && contact.name !== "Guest") known.push(`name=${contact.name}`);
  if (contact.email && !contact.email.endsWith("@repllyer.local")) known.push(`email=${contact.email}`);
  if (contact.phone) known.push(`phone=${contact.phone}`);

  return `You are Repllyer, an AI customer-care bot for a business. ALWAYS try to answer first. Escalation is a LAST resort.

BUSINESS INFO:
${businessInfo || "No additional info"}

KNOWLEDGE BASE:
${kbText ? kbText.slice(0, 8000) : "No knowledge base yet. Use general helpful reasoning, then ask for contact to follow up."}

ALREADY KNOWN ABOUT VISITOR: ${known.length ? known.join(" ") : "nothing yet (guest)"}

AVAILABLE ACTION SCRIPTS (run only when visitor's info is verified and intent matches):
${scriptsBlock}

RULES — follow strictly:
1. TRY TO ANSWER from BUSINESS INFO + KNOWLEDGE BASE first. Give the best helpful answer you can. Only set solvable=false when the request truly needs a human (e.g. account-specific action with no script, legal dispute, angry complaint demanding human).
2. CONTACT CAPTURE is part of answering, not a reason to escalate: if name/email/phone is missing, include ONE short natural ask in your answer (e.g. "Could you share your email and phone number so we can reach you?") and keep solvable=true. Extract anything the visitor provides into extracted_* fields.
3. Phone = mobile number (10+ digits, may include +91/spaces). Email = standard format. Name = what they call themselves.
4. SCRIPTS: if intent matches a script AND all required_params are present in conversation (or this message), set script_to_run to its slug and script_params to the values. If params are missing, do NOT run — instead ask for the missing param conversationally and keep solvable=true. Never invent param values.
5. Priority: urgent=money/payment/refund/billing/legal/compliance; high=product defect/bug/down/delivery failure; medium=account/how-to/order status; low=general/greeting/feedback.
6. Topic: billing, refund, product_quality, bug_report, shipping, account, technical, general.
7. Confidence 0-1 = how sure you are the answer fully resolves the query.

Respond ONLY with valid JSON:
{"priority":"urgent|high|medium|low","topic":"string","solvable":bool,"confidence":0-1,"answer":"string","reason":"string","extracted_email":"string or empty","extracted_name":"string or empty","extracted_phone":"string or empty","script_to_run":"slug or empty","script_params":{}}`;
}

export type ScriptPlanDraft = {
  name: string;
  description: string;
  trigger_keywords: string;
  required_params: string[];
  action_type: "code" | "webhook";
  code_draft: string;
  webhook_hint: string;
  env_needed: string[];
};

export type ScriptPlanChat = {
  ok: boolean;
  reply: string;
  mode: "chat" | "plan";
  questions: string[];
  plan: ScriptPlanDraft | null;
};

export type ScriptPlan = {
  mode: "questions" | "plan";
  questions: string[];
  plan: ScriptPlanDraft | null;
};

function sanitizePlanDraft(p: Record<string, unknown>): ScriptPlanDraft | null {
  if (!p || typeof p.name !== "string" || !p.name.trim()) return null;
  const allowed = ["email", "phone", "name", "order_id", "username", "account_id"];
  return {
    name: String(p.name).slice(0, 80),
    description: String(p.description || "").slice(0, 1000),
    trigger_keywords: String(p.trigger_keywords || "").slice(0, 500),
    required_params: Array.isArray(p.required_params) ? (p.required_params as unknown[]).filter((x): x is string => allowed.includes(x as string)).slice(0, 10) : ["email"],
    action_type: p.action_type === "webhook" ? "webhook" : "code",
    code_draft: String(p.code_draft || "").slice(0, 10000),
    webhook_hint: String(p.webhook_hint || "").slice(0, 500),
    env_needed: Array.isArray(p.env_needed)
      ? (p.env_needed as unknown[]).filter((x): x is string => typeof x === "string").map((x) => x.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 64)).filter(Boolean).slice(0, 20)
      : [],
  };
}

/**
 * Conversational script architect: multi-turn chat. Replies like a teammate,
 * asks at most 2 questions per turn, and emits a full plan once the task is clear.
 */
export async function planScriptChat(opts: {
  businessInfo: string;
  existingScripts: { name: string; description: string }[];
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<ScriptPlanChat> {
  const fallback: ScriptPlanChat = {
    ok: false,
    reply: "Tell me what you want automated — e.g. what should trigger it, what info the visitor must give, and what should happen.",
    mode: "chat",
    questions: [],
    plan: null,
  };

  const system = `You are Repllyer Architect, a friendly teammate helping a business owner automate a task as a chat script. You hold a CONVERSATION — warm, short messages, at most 2 questions per turn. You NEVER create anything; you only plan.

BUSINESS: ${opts.businessInfo || "unknown business"}
EXISTING SCRIPTS (do not duplicate): ${opts.existingScripts.length ? opts.existingScripts.map((s) => `"${s.name}: ${s.description}"`).join(" | ") : "none yet"}

RUNTIME (for plans): sandboxed JavaScript on Vercel. Variables: params (visitor info), contact ({name,email,phone}), business ({id,name}), script ({slug,name}), env (owner secrets as env.KEY). Helpers: sendEmail(to, subject, body), log(...). Author sets global result = {...}. No require/process/fetch — external HTTP means action_type "webhook". required_params only from: email, phone, name, order_id, username, account_id. Secrets ONLY via env.KEY, never hardcoded.

BEHAVIOR:
- If the owner's intent, trigger, required info, or outcome is still unclear, mode "chat": reply conversationally (1-2 short questions AND nothing else — always fill "reply", never leave it empty), questions = those questions, plan = null.
- If everything is clear (including when the owner just answered your questions, or says "draft now" / "make it"), mode "plan" IN THIS RESPONSE: reply with a 1-2 sentence summary + what secrets they must add, and a complete plan object (working JS code_draft, env_needed for every env.KEY used).
- NEVER repeat your opening greeting. NEVER ask for information already given above. NEVER return an empty reply.
- Owner contact details (their email etc.) go in env_needed + read via env.KEY — never hardcode them in code_draft.
- Never invent credentials, URLs, or API keys. Unknown external system → action_type "webhook" + webhook_hint describing the endpoint they must provide.

Respond ONLY with valid JSON:
{"reply":"string","mode":"chat"|"plan","questions":["..."],"plan":null|{"name":"string","description":"string","trigger_keywords":"string","required_params":["email"],"action_type":"code"|"webhook","code_draft":"string","webhook_hint":"string","env_needed":["KEY"]}}`;

  const { ok, parsed } = await chatJson(
    [{ role: "system" as const, content: system }, ...opts.history.slice(-12)],
    { temperature: 0.5, maxTokens: 2500 }
  );
  if (!ok || !parsed) return fallback;
  const plan = parsed.mode === "plan" ? sanitizePlanDraft((parsed.plan || {}) as Record<string, unknown>) : null;
  const questions = Array.isArray(parsed.questions) ? parsed.questions.filter((q: unknown) => typeof q === "string").slice(0, 4) : [];
  // Never leak the generic fallback text into a "successful" reply — derive from content instead.
  let reply = typeof parsed.reply === "string" ? parsed.reply.trim().slice(0, 2000) : "";
  if (!reply) {
    if (plan) reply = `Here's my draft plan for "${plan.name}" — review it below.`;
    else if (questions.length === 1) reply = questions[0];
    else if (questions.length > 1) reply = "Two quick things:\n" + questions.map((q, i) => `${i + 1}) ${q}`).join("\n");
    else reply = "Got that — what should trigger it, and what info must the visitor give first?";
  }
  return { ok: true, reply, mode: plan ? "plan" : "chat", questions, plan };
}

/** Legacy single-shot wrapper — prefer planScriptChat (multi-turn) for new code. */
export async function planScriptForTask(opts: {
  businessInfo: string;
  existingScripts: { name: string; description: string }[];
  task: string;
  answers?: string;
}): Promise<ScriptPlan> {
  const chat = await planScriptChat({
    businessInfo: opts.businessInfo,
    existingScripts: opts.existingScripts,
    history: [{ role: "user", content: `TASK: ${opts.task}${opts.answers ? `\nMY ANSWERS: ${opts.answers}` : ""}` }],
  });
  if (!chat.ok) {
    return {
      mode: "questions",
      questions: ["Planner is unreachable right now — try again in a minute."],
      plan: null,
    };
  }
  if (chat.mode === "plan" && chat.plan) return { mode: "plan", questions: [], plan: chat.plan };
  return { mode: "questions", questions: chat.questions.length ? chat.questions : [chat.reply], plan: null };
}

export async function classifyAndAnswer(opts: {
  businessInfo: string;
  kbText: string;
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
  scripts?: ScriptDef[];
  contact?: { name: string; email: string; phone: string };
}): Promise<KiraaiClassifyResult> {
  const fallback: KiraaiClassifyResult = {
    priority: "medium",
    topic: "general",
    solvable: true,
    confidence: 0.5,
    answer: "Thanks for reaching out! Could you share a bit more detail plus your email and phone number so we can help and reach you?",
    reason: "fallback-answer-first",
  };

  const system = buildSystemPrompt(opts.businessInfo, opts.kbText, opts.scripts || [], opts.contact || { name: "", email: "", phone: "" });
  const messages = [
    { role: "system" as const, content: system },
    ...opts.history.slice(-10),
    { role: "user" as const, content: opts.userMessage },
  ];

  const { ok, parsed } = await chatJson(messages, { temperature: 0.4, maxTokens: 2000 });
  if (!ok || !parsed) return fallback;

  return {
    priority: ["urgent", "high", "medium", "low"].includes(parsed.priority as string) ? (parsed.priority as KiraaiClassifyResult["priority"]) : "medium",
    topic: typeof parsed.topic === "string" ? parsed.topic.slice(0, 40) : "general",
    solvable: typeof parsed.solvable === "boolean" ? parsed.solvable : true,
    confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
    answer: typeof parsed.answer === "string" && parsed.answer.trim() ? parsed.answer : fallback.answer,
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
    extracted_email: typeof parsed.extracted_email === "string" ? parsed.extracted_email : "",
    extracted_name: typeof parsed.extracted_name === "string" ? parsed.extracted_name : "",
    extracted_phone: typeof parsed.extracted_phone === "string" ? parsed.extracted_phone : "",
    script_to_run: typeof parsed.script_to_run === "string" ? parsed.script_to_run : "",
    script_params: typeof parsed.script_params === "object" && parsed.script_params !== null ? (parsed.script_params as Record<string, string>) : {},
  };
}
