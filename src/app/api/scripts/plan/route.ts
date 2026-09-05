import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { planScriptForTask } from "@/lib/kiraai";
import { z } from "zod";

const Body = z.object({
  business_id: z.string().uuid(),
  task: z.string().min(4).max(2000),
  answers: z.string().max(2000).optional().default(""),
});

/**
 * AI architect: owner describes a task → AI asks clarifying questions
 * OR returns a full ready-to-review script plan. Planning is free
 * (no credits) — only real chat executions cost 30cr.
 */
export async function POST(req: NextRequest) {
  const supaAuth = await createServerSupabase();
  const {
    data: { user },
  } = await supaAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "describe the task (4+ chars)" }, { status: 400 });
  const { business_id, task, answers } = parsed.data;

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

  const plan = await planScriptForTask({
    businessInfo: `${(biz as { name: string }).name}\n${(biz as { description: string }).description || ""}`,
    existingScripts: ((existing as { name: string; description: string }[]) || []).map((s) => ({ name: s.name, description: s.description })),
    task: task.trim(),
    answers: answers?.trim(),
  });

  return NextResponse.json(plan);
}
