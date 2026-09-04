import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { hashKey } from "@/lib/api-auth";
import crypto from "crypto";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const service = createServiceClient();
  const { data: biz } = await service.from("businesses").select("id").eq("id", id).eq("owner_user_id", user.id).maybeSingle();
  if (!biz) return NextResponse.json({ error: "not found" }, { status: 404 });

  const raw = `rply_live_${crypto.randomBytes(24).toString("hex")}`;
  const hash = hashKey(raw);
  await service.from("api_keys").update({ is_active: false }).eq("business_id", id);
  const { error } = await service.from("api_keys").insert({ business_id: id, key_hash: hash, prefix: raw.slice(0, 12) });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ api_key: raw });
}
