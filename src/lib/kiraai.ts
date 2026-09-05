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
