type KiraaiClassifyResult = {
  priority: "urgent" | "high" | "medium" | "low";
  topic: string;
  solvable: boolean;
  confidence: number;
  answer: string;
  reason: string;
  extracted_email?: string;
  extracted_name?: string;
};

const BASE = process.env.KIRAAI_BASE_URL || process.env.KIRA_BASE_URL || "https://kiraai.vn/api/v1";
const KEY = (process.env.KIRAAI_API_KEY || process.env.KIRA_API_KEY || "") as string;
const MODEL = process.env.KIRAAI_MODEL || process.env.KIRA_MODEL || "gpt-4o-mini";

function buildSystemPrompt(businessInfo: string, kbText: string) {
  return `You are Repllyer, an AI customer-care bot for a business.

BUSINESS INFO:
${businessInfo || "No additional info"}

KNOWLEDGE BASE:
${kbText ? kbText.slice(0, 8000) : "No knowledge base yet. Answer generally and mark low confidence if unsure."}

TASK: For each customer message:
1. Answer helpfully using BUSINESS INFO + KNOWLEDGE BASE. If info missing, say you don't know.
2. If the user hasn't provided name/email yet in this chat, politely ask for it once (e.g. "Could you share your name and email so we can follow up?"). Extract email/name if they gave it.
3. Classify priority:
   - urgent: money/payment/refund/billing, legal, compliance
   - high: product quality defect, bug, service down, delivery failure
   - medium: account / how-to / order status without money impact
   - low: general inquiry / feedback / greeting
4. Classify topic into one of: billing, refund, product_quality, bug_report, shipping, account, technical, general
5. Decide solvable: true if you could answer confidently without human, false otherwise.
6. Provide confidence 0-1.

Respond ONLY with valid JSON matching:
{"priority":"urgent|high|medium|low","topic":"string","solvable":bool,"confidence":0-1,"answer":"string","reason":"string","extracted_email":"string or empty","extracted_name":"string or empty"}`;
}

export async function classifyAndAnswer(opts: {
  businessInfo: string;
  kbText: string;
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
}): Promise<KiraaiClassifyResult> {
  const fallback: KiraaiClassifyResult = {
    priority: "medium",
    topic: "general",
    solvable: false,
    confidence: 0.4,
    answer: "Thanks for reaching out — I've forwarded your query to our support team. They'll get back to you shortly.",
    reason: "fallback",
  };

  if (!KEY) return fallback;

  const system = buildSystemPrompt(opts.businessInfo, opts.kbText);
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
        temperature: 0.3,
        response_format: { type: "json_object" },
        max_tokens: 800,
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
      solvable: Boolean(parsed.solvable),
      confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      answer: typeof parsed.answer === "string" ? parsed.answer : fallback.answer,
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
      extracted_email: typeof parsed.extracted_email === "string" ? parsed.extracted_email : "",
      extracted_name: typeof parsed.extracted_name === "string" ? parsed.extracted_name : "",
    };
  } catch (e) {
    console.error("kiraai parse error", e);
    return fallback;
  }
}
