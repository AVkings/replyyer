import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { z } from "zod";

const Body = z.object({
  session_id: z.string().uuid(),
  business_id: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supaAuth = await createServerSupabase();
  const {
    data: { user },
  } = await supaAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { session_id, business_id, content } = parsed.data;

  const service = createServiceClient();
  const { data: biz } = await service.from("businesses").select("id").eq("id", business_id).eq("owner_user_id", user.id).maybeSingle();
  if (!biz) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Ensure session belongs to business
  const { data: sess } = await service.from("sessions").select("id").eq("id", session_id).eq("business_id", business_id).maybeSingle();
  if (!sess) return NextResponse.json({ error: "session not found" }, { status: 404 });

  // Save human message — this IS delivered: polling endpoint returns it instantly
  const { data: msg, error } = await service
    .from("messages")
    .insert({ session_id, business_id, role: "human", content })
    .select("id, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flip ticket to assigned so inbox shows takeover (unless id === "direct")
  if (id && id !== "direct") {
    await service.from("human_tickets").update({ status: "assigned" }).eq("id", id).eq("business_id", business_id).eq("status", "open");
  } else {
    // No ticket yet: mark any open ticket for session as assigned
    await service.from("human_tickets").update({ status: "assigned" }).eq("session_id", session_id).eq("business_id", business_id).eq("status", "open");
  }

  return NextResponse.json({ ok: true, message_id: msg.id, delivered: true });
}
