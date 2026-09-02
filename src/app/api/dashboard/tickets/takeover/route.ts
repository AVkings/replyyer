import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const ticketId = body?.ticketId as string | undefined;
  if (!ticketId) return NextResponse.json({ error: "ticketId required" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();

  const { data: ticket } = await admin.from("tickets").select("id, organization_id, conversation_id").eq("id", ticketId).single();
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  // Ownership check (soft)
  const { data: org } = await admin.from("organizations").select("id").eq("id", ticket.organization_id).eq("owner_id", user.id).single();
  if (!org) {
    const { data: any } = await admin.from("organizations").select("id").eq("id", ticket.organization_id).limit(1).single();
    if (!any) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: tErr } = await admin.from("tickets").update({ status: "escalated" }).eq("id", ticketId);
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  await admin.from("conversations").update({ status: "escalated" }).eq("id", ticket.conversation_id);

  return NextResponse.json({ success: true });
}
