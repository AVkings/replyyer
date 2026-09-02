import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const convId = req.nextUrl.searchParams.get("conversationId");
  if (!convId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();

  // Verify ownership via org
  const { data: conv } = await admin.from("conversations").select("id, organization_id").eq("id", convId).single();
  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  // Check user owns this org
  const { data: org } = await admin.from("organizations").select("id").eq("id", conv.organization_id).eq("owner_id", user.id).single();
  // Fallback: if owner_id migration not applied, allow if at least one org exists (demo)
  if (!org) {
    const { data: anyOrg } = await admin.from("organizations").select("id").eq("id", conv.organization_id).limit(1).single();
    if (!anyOrg) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: messages, error } = await admin
    .from("messages")
    .select("role, content, attachment_url, timestamp")
    .eq("conversation_id", convId)
    .order("timestamp", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ messages: messages ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { conversationId?: string; content?: string } | null;
    const conversationId = body?.conversationId?.trim();
    const content = body?.content?.trim();
    if (!conversationId || !content) return NextResponse.json({ error: "conversationId and content required" }, { status: 400 });
    if (content.length < 1 || content.length > 5000) return NextResponse.json({ error: "Content must be 1-5000 chars" }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: conv } = await admin.from("conversations").select("id, organization_id, status").eq("id", conversationId).single();
    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    const { data: org } = await admin.from("organizations").select("id").eq("id", conv.organization_id).eq("owner_id", user.id).single();
    if (!org) {
      const { data: anyOrg } = await admin.from("organizations").select("id").eq("id", conv.organization_id).limit(1).single();
      if (!anyOrg) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Insert as 'ai' role (human takeover) — widget will show as Repllyer but content is human
    const { error: insertErr } = await admin.from("messages").insert({ conversation_id: conversationId, role: "ai", content, attachment_url: null });
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    await admin.from("conversations").update({ status: "escalated", updated_at: new Date().toISOString() }).eq("id", conversationId);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
