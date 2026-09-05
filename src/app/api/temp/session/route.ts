import { NextResponse } from "next/server";
import { TEMP_BOT_API_KEY } from "@/lib/temp-bot";
import { corsHeaders } from "@/lib/cors";

export async function OPTIONS() {
  return NextResponse.json({ ok: true }, { headers: corsHeaders() });
}

export async function POST(req: Request) {
  try {
    // Proxy to real Vercel API with server-side key — client never sees key
    const body = await req.json().catch(() => ({}));
    const r = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://repllyer.vercel.app"}/api/v1/session/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": TEMP_BOT_API_KEY,
      },
      body: JSON.stringify(body || {}),
    });
    const j = await r.json();
    return NextResponse.json(j, { status: r.status, headers: corsHeaders() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "proxy error";
    return NextResponse.json({ error: msg }, { status: 500, headers: corsHeaders() });
  }
}
