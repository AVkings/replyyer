import { NextRequest, NextResponse } from "next/server";
import { ingestKnowledgeBaseFromUrl, ingestKnowledgeBaseFromText } from "@/lib/knowledge/actions";

/**
 * POST /api/ingest
 * Body: { "url": "https://example.com/docs", "organizationId": "uuid-optional" }
 *    or { "text": "raw docs / JSON / CSV", "title": "optional", "organizationId": "uuid-optional" }
 * Returns: { success, url, chunksIngested, ... } or { success:false, error }
 *
 * Useful for cURL, Make/Zapier, or embedding in external dashboards.
 * Business owner UI should prefer the Server Action directly (progressive enhancement).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || (typeof body.url !== "string" && typeof body.text !== "string")) {
      return NextResponse.json(
        { success: false, error: "Missing required field: url (string) or text (string). Send {url} or {text, title}" },
        { status: 400 }
      );
    }

    const organizationId: string | undefined =
      typeof body.organizationId === "string" ? body.organizationId.trim() : undefined;

    let result;
    if (typeof body.text === "string" && body.text.trim()) {
      const text: string = body.text;
      const title: string | undefined = typeof body.title === "string" ? body.title.trim() : undefined;
      result = await ingestKnowledgeBaseFromText(text, title, organizationId);
    } else {
      if (!body.url || typeof body.url !== "string" || !body.url.trim()) {
        return NextResponse.json({ success: false, error: "Missing url" }, { status: 400 });
      }
      const url: string = body.url.trim();
      result = await ingestKnowledgeBaseFromUrl(url, organizationId);
    }

    if (!result.success) {
      return NextResponse.json(result, { status: 422 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[POST /api/ingest]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: "POST /api/ingest with JSON { url, organizationId? } or { text, title?, organizationId? }",
    examples: [
      { url: "https://example.com/help", organizationId: "optional-uuid" },
      { text: "Paste raw docs / JSON / CSV here...", title: "My KB", organizationId: "optional-uuid" },
    ],
  });
}
