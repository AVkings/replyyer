import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey, extractApiKey } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase";
import { corsHeaders } from "@/lib/cors";

// Polling endpoint for end-users: after escalation, human replies appear here instantly.
export async function GET(req: NextRequest) {
  const rawKey = extractApiKey(req);
  const keyData = await verifyApiKey(rawKey || "");
  if (!keyData) return NextResponse.json({ error: "invalid api_key" }, { status: 401, headers: corsHeaders() });

  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get("session_id");
  const after = searchParams.get("after"); // ISO timestamp, optional
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400, headers: corsHeaders() });

  const supa = createServiceClient();
  const { data: sess } = await supa.from("sessions").select("id, business_id").eq("id", session_id).maybeSingle();
  if (!sess || sess.business_id !== keyData.business_id) {
    return NextResponse.json({ error: "session not found" }, { status: 404, headers: corsHeaders() });
  }

  let q = supa.from("messages").select("id, role, content, created_at").eq("session_id", session_id).order("created_at", { ascending: true }).limit(100);
  if (after) q = q.gt("created_at", after);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  return NextResponse.json({ messages: data || [] }, { headers: corsHeaders() });
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true }, { headers: corsHeaders() });
}
