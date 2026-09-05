import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

/**
 * Owner-only provider connectivity check. Visit while logged in:
 *   https://repllyer.vercel.app/api/debug/provider
 * Returns reachability diagnostics — NEVER echoes keys or secrets.
 */
export async function GET() {
  const supaAuth = await createServerSupabase();
  const {
    data: { user },
  } = await supaAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const base = process.env.KIRAAI_BASE_URL || process.env.KIRA_BASE_URL || "https://kiraai.vn/api/v1";
  const key = process.env.KIRAAI_API_KEY || process.env.KIRA_API_KEY || "";
  const model = process.env.KIRAAI_MODEL || process.env.KIRA_MODEL || "gpt-4o-mini";

  const info: Record<string, unknown> = {
    base,
    model,
    keyPresent: key.length > 0,
    keyLen: key.length,
    node: process.version,
    region: process.env.VERCEL_REGION || "unknown",
  };

  if (!key) {
    return NextResponse.json({ ...info, ok: false, detail: "missing api key" });
  }

  const started = Date.now();
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Repllyer/1.0 (+https://repllyer.vercel.app)",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "reply with ok" }],
        max_tokens: 50,
      }),
    });
    const text = await res.text();
    let content = "";
    try {
      const j = JSON.parse(text);
      const choices = (j.choices || []) as { message?: { content?: string } }[];
      content = String(choices[0]?.message?.content || "").slice(0, 200);
    } catch {
      content = `non-JSON body: ${text.slice(0, 200)}`;
    }
    return NextResponse.json({
      ...info,
      ok: res.ok && content.length > 0,
      status: res.status,
      ms: Date.now() - started,
      content,
    });
  } catch (e) {
    return NextResponse.json({
      ...info,
      ok: false,
      ms: Date.now() - started,
      detail: `network: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300),
    });
  }
}
