export default function Docs() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 grid md:grid-cols-[220px_1fr] gap-10">
      <aside className="hidden md:block">
        <div className="sticky top-24 space-y-6 text-sm">
          <div>
            <div className="font-semibold">Getting Started</div>
            <ul className="mt-2 space-y-1 text-zinc-600">
              <li><a href="#quick" className="hover:text-black">Quickstart</a></li>
              <li><a href="#auth" className="hover:text-black">Auth & API key</a></li>
              <li><a href="#session" className="hover:text-black">Session</a></li>
              <li><a href="#chat" className="hover:text-black">Chat</a></li>
              <li><a href="#priority" className="hover:text-black">Priority & Topic</a></li>
              <li><a href="#billing" className="hover:text-black">Credits & Billing</a></li>
              <li><a href="#errors" className="hover:text-black">Errors</a></li>
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs">
            Base URL for all API calls: <code className="font-mono">https://repllyer.vercel.app</code>
          </div>
        </div>
      </aside>
      <article className="prose max-w-none prose-zinc prose-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Repllyer Docs</h1>
        <p className="text-zinc-600">API-first customer care. Base URL <code>https://repllyer.vercel.app</code>. One key powers session + chat, with human takeover and priority sorting.</p>

        <h2 id="quick" className="mt-8 font-semibold">Quickstart</h2>
        <ol className="list-decimal pl-5 text-sm text-zinc-700 space-y-1">
          <li>Sign up at /signup (email + password) — you get 180 free credits.</li>
          <li>Create Business → paste what you sell + upload PDFs or raw text (knowledge base).</li>
          <li>Copy <code>rply_live_...</code> once. Regenerate anytime from Settings (you'll see prefix + ID).</li>
          <li>Call <code>POST https://repllyer.vercel.app/api/v1/session/init</code> — <b>no email/name needed</b>. Our bot will ask the visitor if missing, or treat them as guest.</li>
          <li>Call <code>POST https://repllyer.vercel.app/api/v1/chat</code> with <code>session_id, message</code>.</li>
          <li>Try it live at <a href="/test" className="underline">/test</a> — no curl needed.</li>
        </ol>

        <h2 id="auth" className="mt-8 font-semibold">Auth</h2>
        <p className="text-sm text-zinc-600">Send API key as <code>x-api-key: rply_live_...</code> or <code>Authorization: Bearer rply_live_...</code>. Keys are hashed, keep server-side.</p>

        <h2 id="session" className="mt-8 font-semibold">POST /api/v1/session/init</h2>
        <p className="text-xs text-zinc-500 mb-2">No email/name required — bot retrieves it. Send empty body for guest.</p>
        <pre className="overflow-auto rounded-xl bg-zinc-950 p-4 text-xs leading-5 text-zinc-200">{`curl -X POST https://repllyer.vercel.app/api/v1/session/init \\
  -H "x-api-key: rply_live_..." -H "Content-Type: application/json" \\
  -d '{}'
# optional: -d '{"name":"Aarav","email":"aarav@example.com"}'

# 200 { "session_id": "uuid", "expires_at": "...", "credits_remaining": 177, "guest": true }
# 401 invalid key, 402 credits exhausted`}</pre>

        <h2 id="chat" className="mt-8 font-semibold">POST /api/v1/chat</h2>
        <pre className="overflow-auto rounded-xl bg-zinc-950 p-4 text-xs leading-5 text-zinc-200">{`curl -X POST https://repllyer.vercel.app/api/v1/chat \\
  -H "x-api-key: rply_live_..." -H "Content-Type: application/json" \\
  -d '{"session_id":"uuid","message":"my refund not received"}'

# auto-resolved
{ "status":"resolved","answer":"...","priority":"urgent","topic":"refund","confidence":0.88 }

# needs human
{ "status":"human_required","ticket_id":"uuid","priority":"urgent","topic":"refund" }
# Dashboard picks via inbox / CRM`}</pre>
        <p className="text-xs text-zinc-500">1 credit per call. History (last 10) + knowledge base sent to AI securely.</p>

        <h2 id="priority" className="mt-8 font-semibold">Priority & Topic</h2>
        <ul className="list-disc pl-5 text-sm text-zinc-700">
          <li><b>urgent</b>: payment/refund/billing/legal</li>
          <li><b>high</b>: product quality / bug / delivery failure</li>
          <li><b>medium</b>: account / how-to</li>
          <li><b>low</b>: general / greeting</li>
        </ul>
        <p className="text-sm text-zinc-600">Topics: billing, refund, product_quality, bug_report, shipping, account, technical, general. Sorted in Inbox.</p>

        <h2 id="billing" className="mt-8 font-semibold">Credits & Billing</h2>
        <p className="text-sm text-zinc-600">180 free on first business. Each extra business costs 100 credits. Buy packs from Dashboard → Billing. Coupons are fixed Rs off (e.g. <code>FLAT600 = ₹600 off</code>, <code>WELCOME500 = ₹500 off</code>). Gift cards redeem credits directly.</p>

        <h2 id="errors" className="mt-8 font-semibold">Errors</h2>
        <pre className="rounded-xl bg-white border border-zinc-200 p-4 text-xs">{`401 invalid api key
402 credits exhausted / 100 credits needed for extra business
404 session not found
410 session expired, re-init`}</pre>

        <p className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">Onboarding: visit <a href="/onboarding" className="underline">/onboarding</a> after signup — 3 steps to your first chat. Test bot at <a href="/test" className="underline">/test</a>.</p>
      </article>
    </div>
  );
}
