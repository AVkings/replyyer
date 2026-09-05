import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { planScriptChat } from "@/lib/kiraai";
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
 * anything is created. Returns { reply, mode, questions, plan }.
 * Planning is free (no credits) — only live visitor runs cost 30cr.
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

  const out = await planScriptChat({
    businessInfo: `${(biz as { name: string }).name}\n${(biz as { description: string }).description || ""}`,
    existingScripts: ((existing as { name: string; description: string }[]) || []).map((s) => ({ name: s.name, description: s.description })),
    history,
  });

  return NextResponse.json(out);
}
