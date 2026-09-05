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
): Promise<{ ok: boolean; parsed: Record<string, unknown> | null; detail: string }> {
  if (!KEY) return { ok: false, parsed: null, detail: "missing api key" };
  let detail = "unknown";
  for (const max_tokens of [opts.maxTokens, opts.maxTokens + 2000]) {
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "Repllyer/1.0 (+https://repllyer.vercel.app)",
          Authorization: `Bearer ${KEY}`,
        },
        body: JSON.stringify({ model: MODEL, messages, temperature: opts.temperature, response_format: { type: "json_object" }, max_tokens }),
      });
      if (!res.ok) {
        detail = `http ${res.status}: ${(await res.text()).slice(0, 200)}`;
        console.error("kiraai error", detail);
        continue;
      }
      let json: Record<string, unknown>;
      try {
        json = await res.json();
      } catch {
        detail = "non-JSON response body";
        continue;
      }
      const choices = (json.choices as { message?: { content?: string } }[] | undefined) || [];
      const text = stripFences(String(choices[0]?.message?.content || ""));
      if (!text) {
        detail = "empty content (cut off)";
        continue; // cut off before content — retry with bigger budget
      }
      try {
        return { ok: true, parsed: JSON.parse(text), detail: "ok" };
      } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            return { ok: true, parsed: JSON.parse(m[0]), detail: "ok" };
          } catch {
            detail = "unparseable content";
          }
        } else {
          detail = "unparseable content";
        }
      }
    } catch (e) {
      detail = `network: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200);
      console.error("kiraai fetch error", detail);
    }
  }
  return { ok: false, parsed: null, detail };
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

/**
 * Plain-text chat (NO response_format constraint — reasoning models handle
 * natural replies far more reliably than strict JSON mode).
 */
async function chatNatural(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { temperature: number; maxTokens: number }
): Promise<{ ok: boolean; text: string; detail: string }> {
  if (!KEY) return { ok: false, text: "", detail: "missing api key" };
  let detail = "unknown";
  for (const max_tokens of [opts.maxTokens, opts.maxTokens + 2000]) {
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "Repllyer/1.0 (+https://repllyer.vercel.app)",
          Authorization: `Bearer ${KEY}`,
        },
        body: JSON.stringify({ model: MODEL, messages, temperature: opts.temperature, max_tokens }),
      });
      if (!res.ok) {
        detail = `http ${res.status}: ${(await res.text()).slice(0, 200)}`;
        console.error("kiraai error", detail);
        continue;
      }
      let text = "";
      try {
        const json = await res.json();
        const choices = (json.choices as { message?: { content?: string } }[] | undefined) || [];
        text = String(choices[0]?.message?.content || "").trim();
      } catch {
        detail = "non-JSON response body";
        continue;
      }
      if (!text) {
        detail = "empty content (cut off)";
        continue;
      }
      return { ok: true, text, detail: "ok" };
    } catch (e) {
      detail = `network: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200);
      console.error("kiraai fetch error", detail);
    }
  }
  return { ok: false, text: "", detail };
}

type FencedBlock = { tag: string; code: string; start: number; end: number };

/** Split ```fenced blocks out of chat text (tags like javascript, plan-json). */
function splitFenced(text: string): FencedBlock[] {
  const re = /```([^\n`]*)\n?([\s\S]*?)```/g;
  const blocks: FencedBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    blocks.push({ tag: m[1].trim(), code: m[2], start: m.index, end: m.index + m[0].length });
  }
  return blocks;
}

function tryParseJson(s: string): Record<string, unknown> {
  const t = stripFences(s.trim());
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return {};
      }
    }
    return {};
  }
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
  detail: string;
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
    detail: "unreachable",
    reply: "Tell me what you want automated — e.g. what should trigger it, what info the visitor must give, and what should happen.",
    mode: "chat",
    questions: [],
    plan: null,
  };

  const system = `You are Repllyer Architect, a friendly teammate helping a business owner automate a task as a chat script. Chat naturally like a normal chatbot — short warm messages, at most 2 questions per turn. You NEVER create anything yourself; you draft for review.

BUSINESS: ${opts.businessInfo || "unknown business"}
EXISTING SCRIPTS (do not duplicate): ${opts.existingScripts.length ? opts.existingScripts.map((s) => `"${s.name}: ${s.description}"`).join(" | ") : "none yet"}

RUNTIME (for code): sandboxed JavaScript on Vercel. Variables: params (visitor info), contact ({name,email,phone}), business ({id,name}), script ({slug,name}), env (owner secrets as env.KEY). Helpers: sendEmail(to, subject, body), log(...). Author sets global result = {...}. No require/process/fetch — external HTTP means a webhook instead. Secrets ONLY via env.KEY, never hardcoded. required_params only from: email, phone, name, order_id, username, account_id.

WHEN EVERYTHING IS CLEAR (intent + trigger + required info + outcome — or the owner says "draft now" / "make it"), end your reply with TWO fenced blocks:
1. Plan metadata, exactly like this (fill every field):
\`\`\`plan-json
{"name":"...","description":"...","trigger_keywords":"...","required_params":["email"],"action_type":"code","env_needed":["KEY"]}
\`\`\`
2. The full working JavaScript in a \`\`\`javascript block (skip it for webhooks — say the endpoint needed in plain text instead).

RULES: never repeat your greeting, never re-ask answered info, never leave the reply empty. Owner contacts go in env_needed, never hardcoded. Never invent credentials, URLs, or keys. Normal chat text stays OUTSIDE fenced blocks.`;

  const { ok, text, detail } = await chatNatural(
    [{ role: "system" as const, content: system }, ...opts.history.slice(-12)],
    { temperature: 0.5, maxTokens: 3000 }
  );
  if (!ok) return { ...fallback, detail };

  const blocks = splitFenced(text);
  const planBlock = blocks.find((b) => b.tag.toLowerCase() === "plan-json") || null;
  const plan = planBlock ? sanitizePlanDraft(tryParseJson(planBlock.code)) : null;
  const rest = blocks.filter((b) => b !== planBlock);
  const jsBlock =
    rest.find((b) => /^(javascript|js)$/i.test(b.tag)) ||
    rest.slice().sort((a, b) => b.code.length - a.code.length)[0] ||
    null;
  const code = jsBlock ? jsBlock.code.trim().slice(0, 10000) : "";

  if (plan) {
    const finalPlan = plan.action_type === "code" && code ? { ...plan, code_draft: code } : plan;
    const consumed = [planBlock, finalPlan.action_type === "code" ? jsBlock : null].filter(
      (b): b is FencedBlock => b !== null
    );
    const ordered = consumed.sort((a, b) => a.start - b.start);
    let reply = "";
    let last = 0;
    for (const b of ordered) {
      reply += text.slice(last, b.start);
      last = b.end;
    }
    reply += text.slice(last);
    reply = reply.replace(/\n{3,}/g, "\n\n").trim().slice(0, 2000) || `Here's my draft plan for "${finalPlan.name}" — review it below.`;
    return { ok: true, detail: "ok", reply, mode: "plan", questions: [], plan: finalPlan };
  }
  // No plan yet — show the raw message as-is (fences stay visible).
  return { ok: true, detail: "ok", reply: text.slice(0, 2000), mode: "chat", questions: [], plan: null };
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
