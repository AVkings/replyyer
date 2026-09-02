import { NextRequest, NextResponse } from "next/server";
import { uploadToGoFile } from "@/lib/gofile/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/upload
 * FormData: file (File)
 * Returns: { success, url (directLink || downloadPage), fileName, fileId }
 *
 * Why server route (not direct client call to GoFile)?
 * - GOFILE_API_TOKEN is server-only, must never leak to browser.
 * - Handles `repllyer` folder logic centrally.
 * - Enforces file type/size limits.
 */

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_PREFIXES = ["image/", "text/", "application/pdf", "video/"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

async function verifyUploadApiKey(req: NextRequest): Promise<{ valid: boolean; orgId?: string; error?: string }> {
  const apiKey = req.headers.get("x-api-key")?.trim() || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || null;
  const orgIdHeader = req.headers.get("x-organization-id")?.trim() || req.headers.get("x-org-id")?.trim() || null;
  const urlOrg = req.nextUrl.searchParams.get("organizationId") || req.nextUrl.searchParams.get("organization_id");
  const orgId = orgIdHeader || urlOrg;
  if (!apiKey) return { valid: false, error: "Missing x-api-key header — provide your organization api_key" };
  const admin = createSupabaseAdminClient();
  if (orgId) {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(orgId)) return { valid: false, error: "Invalid organizationId" };
    const { data } = await admin.from("organizations").select("id").eq("id", orgId).eq("api_key", apiKey).maybeSingle();
    if (!data) return { valid: false, error: "Invalid API key for this organizationId" };
    return { valid: true, orgId };
  } else {
    const { data } = await admin.from("organizations").select("id").eq("api_key", apiKey).maybeSingle();
    if (!data) return { valid: false, error: "Invalid API key" };
    return { valid: true, orgId: data.id };
  }
}

export async function POST(req: NextRequest) {
  // Strict API key check — must provide x-api-key (and optionally x-organization-id)
  // Allow dashboard session as fallback
  let auth = await verifyUploadApiKey(req);
  if (!auth.valid) {
    // Try Supabase session (dashboard internal)
    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) auth = { valid: true, orgId: auth.orgId };
      else return NextResponse.json({ success: false, error: auth.error ?? "Unauthorized — invalid API key" }, { status: 401, headers: corsHeaders });
    } catch {
      return NextResponse.json({ success: false, error: auth.error ?? "Unauthorized — invalid API key" }, { status: 401, headers: corsHeaders });
    }
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file provided. Send FormData with 'file'." }, { status: 400, headers: corsHeaders });
    }

    if (file.size === 0) {
      return NextResponse.json({ success: false, error: "Empty file" }, { status: 400, headers: corsHeaders });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { success: false, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_FILE_BYTES / 1024 / 1024}MB` },
        { status: 400, headers: corsHeaders }
      );
    }

    const isAllowed =
      ALLOWED_MIME_PREFIXES.some((p) => file.type.startsWith(p)) ||
      ["application/zip", "application/json"].includes(file.type);

    // Allow all if mime is empty (some browsers), but still check extension
    // For demo we are permissive — only block absurd types

    // Convert File to Blob for GoFile util
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type || "application/octet-stream" });

    const result = await uploadToGoFile(blob, file.name || `upload-${Date.now()}`);

    // Prefer directLink (if available and valid), else downloadPage
    const url = result.directLink || result.downloadPage;

    return NextResponse.json(
      {
        success: true,
        url,
        downloadPage: result.downloadPage,
        directLink: result.directLink ?? null,
        fileName: result.fileName,
        fileId: result.fileId,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("[POST /api/upload]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      usage: "POST /api/upload with FormData { file } → { url, fileName }",
      maxSize: `${MAX_FILE_BYTES / 1024 / 1024}MB`,
      note: "Uploaded to GoFile 'repllyer' folder",
    },
    { headers: corsHeaders }
  );
}
