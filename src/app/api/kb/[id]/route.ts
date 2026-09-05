import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase";

// DELETE /api/kb/:id?type=file|text&business_id=...
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "file";
  const businessId = searchParams.get("business_id");
  if (!businessId) return NextResponse.json({ error: "business_id required" }, { status: 400 });

  const supaAuth = await createServerSupabase();
  const {
    data: { user },
  } = await supaAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: biz } = await service.from("businesses").select("id").eq("id", businessId).eq("owner_user_id", user.id).maybeSingle();
  if (!biz) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (type === "text") {
    const { error } = await service.from("knowledge_bases").delete().eq("id", id).eq("business_id", businessId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Optionally delete from gofile too (best effort)
    const { data: row } = await service.from("kb_files").select("gofile_id").eq("id", id).eq("business_id", businessId).maybeSingle();
    if (row?.gofile_id) {
      try {
        await fetch("https://api.gofile.io/contents", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GOFILE_TOKEN || process.env.GOFILE_API_TOKEN || ""}`,
          },
          body: JSON.stringify({ contentsId: row.gofile_id }),
        });
      } catch {}
    }
    const { error } = await service.from("kb_files").delete().eq("id", id).eq("business_id", businessId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
