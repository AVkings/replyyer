import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { z } from "zod";

const Body = z.object({ status: z.enum(["open", "assigned", "resolved"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supaAuth = await createServerSupabase();
  const {
    data: { user },
  } = await supaAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid status" }, { status: 400 });

  const service = createServiceClient();
  // Verify ticket belongs to user's business
  const { data: t } = await service.from("human_tickets").select("id, business_id").eq("id", id).maybeSingle();
  if (!t) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data: biz } = await service.from("businesses").select("id").eq("id", t.business_id).eq("owner_user_id", user.id).maybeSingle();
  if (!biz) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { error } = await service.from("human_tickets").update({ status: parsed.data.status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: parsed.data.status });
}
