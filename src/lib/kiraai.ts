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

export type ScriptPlan = {
  mode: "questions" | "plan";
  questions: string[];
  plan: {
    name: string;
    description: string;
    trigger_keywords: string;
    required_params: string[];
    action_type: "code" | "webhook";
    code_draft: string;
    webhook_hint: string;
    env_needed: string[];
  } | null;
};

/**
 * AI script architect: plans a client automation BEFORE creating anything.
 * Returns clarifying questions when the task is vague, otherwise a full
 * ready-to-review plan (name, triggers, params, JS code draft, env needed).
 */
export async function planScriptForTask(opts: {
  businessInfo: string;
  existingScripts: { name: string; description: string }[];
  task: string;
  answers?: string;
}): Promise<ScriptPlan> {
  const fallback: ScriptPlan = {
    mode: "questions",
    questions: ["What should trigger this script? (e.g. which visitor message)", "What info must the visitor provide first? (email, phone, order id…)", "What should happen when it runs? (send an email, call your server…)"],
    plan: null,
  };
  if (!KEY) return fallback;

  const system = `You are Repllyer Architect. A business owner describes a task they want automated as a chat script. You PLAN first — never assume missing details.

BUSINESS: ${opts.businessInfo || "unknown business"}
EXISTING SCRIPTS (do not duplicate these): ${opts.existingScripts.length ? opts.existingScripts.map((s) => `"${s.name}: ${s.description}"`).join(" | ") : "none yet"}

RULES:
1. The runtime is sandboxed JavaScript on Vercel: variables available are params (visitor info like params.email), contact ({name,email,phone}), business ({id,name}), script ({slug,name}), env (the owner's secret variables, read as env.KEY). Helpers: sendEmail(to, subject, body), log(...). The author MUST set global result = {...}. No require/process/fetch — external HTTP means action_type "webhook" instead.
2. required_params may only use: email, phone, name, order_id, username, account_id.
3. If the task is vague or missing the trigger / required info / outcome, return mode "questions" with 1-3 short specific questions. Do NOT write a plan yet.
4. If the task is clear (or the owner already answered follow-ups), return mode "plan" with a complete plan: short name, one-line description, comma trigger keywords, required params, action_type ("code" for logic/email, "webhook" when it must hit the owner's server), a working JS code_draft following the runtime contract above (secrets ONLY via env.KEY, never hardcoded), and env_needed listing every env.KEY the code uses.
5. Never invent credentials, URLs, or API keys. If the outcome needs an external system you know nothing about, prefer "webhook" with a webhook_hint describing the endpoint the owner must provide.

Respond ONLY with valid JSON:
{"mode":"questions"|"plan","questions":["..."],"plan":null|{"name":"string","description":"string","trigger_keywords":"string","required_params":["email"],"action_type":"code"|"webhook","code_draft":"string","webhook_hint":"string","env_needed":["KEY"]}}`;

  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `TASK: ${opts.task}${opts.answers ? `\nOWNER ANSWERS: ${opts.answers}` : ""}` },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
        max_tokens: 1500,
      }),
    });
    if (!res.ok) {
      console.error("kiraai plan error", res.status, await res.text());
      return fallback;
    }
    const json = await res.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content || "{}");
    const mode = parsed.mode === "plan" ? "plan" : "questions";
    const questions = Array.isArray(parsed.questions) ? parsed.questions.filter((q: unknown) => typeof q === "string").slice(0, 4) : [];
    if (mode === "plan" && parsed.plan && typeof parsed.plan.name === "string") {
      const p = parsed.plan;
      const allowed = ["email", "phone", "name", "order_id", "username", "account_id"];
      return {
        mode,
        questions: [],
        plan: {
          name: String(p.name).slice(0, 80),
          description: String(p.description || "").slice(0, 1000),
          trigger_keywords: String(p.trigger_keywords || "").slice(0, 500),
          required_params: Array.isArray(p.required_params) ? p.required_params.filter((x: unknown) => allowed.includes(x as string)).slice(0, 10) : ["email"],
          action_type: p.action_type === "webhook" ? "webhook" : "code",
          code_draft: String(p.code_draft || "").slice(0, 10000),
          webhook_hint: String(p.webhook_hint || "").slice(0, 500),
          env_needed: Array.isArray(p.env_needed) ? p.env_needed.filter((x: unknown) => typeof x === "string").map((x: string) => x.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 64)).filter(Boolean).slice(0, 20) : [],
        },
      };
    }
    return { mode: "questions", questions: questions.length ? questions : fallback.questions, plan: null };
  } catch (e) {
    console.error("kiraai plan parse error", e);
    return fallback;
  }
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

  if (!KEY) return fallback;

  const system = buildSystemPrompt(opts.businessInfo, opts.kbText, opts.scripts || [], opts.contact || { name: "", email: "", phone: "" });
  const messages = [
    { role: "system" as const, content: system },
    ...opts.history.slice(-10),
    { role: "user" as const, content: opts.userMessage },
  ];

  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.4,
        response_format: { type: "json_object" },
        max_tokens: 900,
      }),
    });

    if (!res.ok) {
      console.error("kiraai error", res.status, await res.text());
      return fallback;
    }
    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(content);

    return {
      priority: ["urgent", "high", "medium", "low"].includes(parsed.priority) ? parsed.priority : "medium",
      topic: typeof parsed.topic === "string" ? parsed.topic.slice(0, 40) : "general",
      solvable: typeof parsed.solvable === "boolean" ? parsed.solvable : true,
      confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      answer: typeof parsed.answer === "string" && parsed.answer.trim() ? parsed.answer : fallback.answer,
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
      extracted_email: typeof parsed.extracted_email === "string" ? parsed.extracted_email : "",
      extracted_name: typeof parsed.extracted_name === "string" ? parsed.extracted_name : "",
      extracted_phone: typeof parsed.extracted_phone === "string" ? parsed.extracted_phone : "",
      script_to_run: typeof parsed.script_to_run === "string" ? parsed.script_to_run : "",
      script_params: typeof parsed.script_params === "object" && parsed.script_params !== null ? parsed.script_params : {},
    };
  } catch (e) {
    console.error("kiraai parse error", e);
    return fallback;
  }
}
