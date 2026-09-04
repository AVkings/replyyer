import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";
import { uploadToGofile } from "@/lib/gofile";

export async function POST(req: NextRequest) {
  const supaAuth = await createServerSupabase();
  const {
    data: { user },
  } = await supaAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const businessId = form.get("business_id") as string | null;
  const rawText = form.get("raw_text") as string | null;

  if (!businessId) return NextResponse.json({ error: "business_id required" }, { status: 400 });

  const service = createServiceClient();
  // verify owner
  const { data: biz } = await service.from("businesses").select("id").eq("id", businessId).eq("owner_user_id", user.id).maybeSingle();
  if (!biz) return NextResponse.json({ error: "business not found" }, { status: 404 });

  // Handle raw text KB (no file)
  if (rawText) {
    const { error } = await service.from("knowledge_bases").insert({ business_id: businessId, raw_text: rawText.slice(0, 50000) });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, type: "text" });
  }

  if (!file) return NextResponse.json({ error: "file or raw_text required" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "max 20MB" }, { status: 400 });

  // Upload to gofile (server-side, token never leaves server)
  let gofileData;
  try {
    gofileData = await uploadToGofile(file);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "gofile error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Extract text naively (store filename; full extraction can be added with pdf-parse/mammoth)
  // For now store placeholder extracted_text = filename + size, business can also paste raw_text
  const extracted = `File: ${gofileData.name} (${gofileData.size} bytes) - view: ${gofileData.downloadPage}`;

  const { error: dbErr } = await service.from("kb_files").insert({
    business_id: businessId,
    gofile_id: gofileData.id,
    gofile_url: gofileData.downloadPage,
    filename: gofileData.name,
    mimetype: gofileData.mimetype,
    size: gofileData.size,
    extracted_text: extracted,
  });
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, file: gofileData });
}
