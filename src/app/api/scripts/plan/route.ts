import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { planScriptChat } from "@/lib/kiraai";
import { getBalance, consumeCredit } from "@/lib/credits";
import { z } from "zod";

const Msg = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const Body = z.object({
  business_id: z.string().uuid(),
  history: z.array(Msg).min(1).max(20),
});

/**
 * AI architect chat: multi-turn conversation that plans a script BEFORE
 * anything is created. Returns { reply, mode, questions, plan, credits_remaining }.
 * Each planner message costs 1 credit (like visitor chat). Live runs cost 30cr.
 * Provider failures return 503 with NO charge — never a fake looping reply.
 */
export async function POST(req: NextRequest) {
  const supaAuth = await createServerSupabase();
  const {
    data: { user },
  } = await supaAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "send chat history (1–20 messages)" }, { status: 400 });
  const { business_id, history } = parsed.data;
  if (!history.some((m) => m.role === "user")) {
    return NextResponse.json({ error: "say what you want automated" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: biz } = await service
    .from("businesses")
    .select("id, name, description")
    .eq("id", business_id)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!biz) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: existing } = await service
    .from("business_scripts")
    .select("name, description")
    .eq("business_id", business_id)
    .limit(20);

  // 1 credit per planner message — check upfront so broke accounts get a clear 402
  const balBefore = await getBalance(business_id).catch(() => 0);
  if (balBefore <= 0) {
    return NextResponse.json({ error: "out of credits — top up in Billing to keep chatting with the builder." }, { status: 402 });
  }

  const out = await planScriptChat({
    businessInfo: `${(biz as { name: string }).name}\n${(biz as { description: string }).description || ""}`,
    existingScripts: ((existing as { name: string; description: string }[]) || []).map((s) => ({ name: s.name, description: s.description })),
    history,
  });

  // Provider down/blocked → honest error with diagnosis, NO charge, NO fake looping reply
  if (!out.ok) {
    return NextResponse.json({ error: `AI planner unreachable (${out.detail}) — try again in a minute. No credits used.` }, { status: 503 });
  }

  const consumed = await consumeCredit(business_id, "ai_plan_chat");
  const credits_remaining = consumed.ok ? consumed.balance : balBefore;
  return NextResponse.json({ ...out, credits_remaining });
}
