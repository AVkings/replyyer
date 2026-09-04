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
              <li><a href="#errors" className="hover:text-black">Errors</a></li>
              <li><a href="#webhook" className="hover:text-black">Razorpay</a></li>
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs">
            Supabase table <code className="font-mono">human_tickets</code> is Realtime-enabled for inbox.
          </div>
        </div>
      </aside>
      <article className="prose max-w-none prose-zinc prose-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Repllyer Docs</h1>
        <p className="text-zinc-600">API-first customer care. Hosted on Vercel, database Supabase, file store Gofile, AI via kiraai.vn.</p>

        <h2 id="quick" className="mt-8 font-semibold">Quickstart</h2>
        <ol className="list-decimal pl-5 text-sm text-zinc-700 space-y-1">
          <li>Sign up at /signup (email + password, Supabase Auth).</li>
          <li>Create Business → paste what you sell + upload PDFs (to Gofile) or raw text KB.</li>
          <li>Copy <code>rply_live_...</code> once. Regenerate anytime from dashboard.</li>
          <li>Call <code>POST /api/v1/session/init</code> with <code>name, email</code> on page load.</li>
          <li>Call <code>POST /api/v1/chat</code> with <code>session_id, message</code>.</li>
        </ol>

        <h2 id="auth" className="mt-8 font-semibold">Auth</h2>
        <p className="text-sm text-zinc-600">Send API key as <code>x-api-key: rply_live_...</code> or <code>Authorization: Bearer rply_live_...</code>. Keys are SHA256-hashed in Supabase <code>api_keys</code>. Use server-side only.</p>

        <h2 id="session" className="mt-8 font-semibold">POST /api/v1/session/init</h2>
        <pre className="overflow-auto rounded-xl bg-zinc-950 p-4 text-xs leading-5 text-zinc-200">{`curl -X POST $APP/api/v1/session/init \\
  -H "x-api-key: rply_live_..." -H "Content-Type: application/json" \\
  -d '{"name":"Aarav","email":"aarav@example.com"}'

# 200 { "session_id": "uuid", "expires_at": "...", "credits_remaining": 177 }
# 401 invalid key, 402 credits exhausted
# Expires after 30m idle; page reload => new session (client discards id)`}</pre>

        <h2 id="chat" className="mt-8 font-semibold">POST /api/v1/chat</h2>
        <pre className="overflow-auto rounded-xl bg-zinc-950 p-4 text-xs leading-5 text-zinc-200">{`curl -X POST $APP/api/v1/chat \\
  -H "x-api-key: rply_live_..." -H "Content-Type: application/json" \\
  -d '{"session_id":"uuid","message":"my refund not received"}'

# auto-resolved
{ "status":"resolved","answer":"...","priority":"urgent","topic":"refund","confidence":0.88,"credits_remaining":176 }

# needs human
{ "status":"human_required","ticket_id":"uuid","priority":"urgent","topic":"refund","answer":"I've forwarded...","credits_remaining":176 }
# Dashboard picks via human_tickets (Realtime)`}</pre>
        <p className="text-xs text-zinc-500">1 credit per call even if human_required. History sent as last 10 messages + KB to kiraai.vn.</p>

        <h2 id="priority" className="mt-8 font-semibold">Priority & Topic</h2>
        <ul className="list-disc pl-5 text-sm text-zinc-700">
          <li><b>urgent</b>: payment/refund/billing/legal</li>
          <li><b>high</b>: product quality / bug / delivery failure</li>
          <li><b>medium</b>: account / how-to</li>
          <li><b>low</b>: general / greeting</li>
        </ul>
        <p className="text-sm text-zinc-600">Topics: <code>billing, refund, product_quality, bug_report, shipping, account, technical, general</code>. Sorted in dashboard inbox by priority.</p>

        <h2 id="errors" className="mt-8 font-semibold">Errors</h2>
        <pre className="rounded-xl bg-white border border-zinc-200 p-4 text-xs">{`401 invalid api key
402 credits exhausted { credits_remaining: 0 }
404 session not found
410 session expired, re-init
429 rate limited (future)`}</pre>

        <h2 id="webhook" className="mt-8 font-semibold">Credits & Razorpay</h2>
        <p className="text-sm text-zinc-600">Dashboard → Billing → Buy pack triggers Razorpay Checkout. Webhook <code>POST /api/webhooks/razorpay</code> verifies <code>x-razorpay-signature</code> and calls <code>grantCredits(business_id, credits)</code>. Include <code>notes: &#123; business_id, credits &#125;</code> in order.</p>

        <h2 className="mt-8 font-semibold">Storage</h2>
        <p className="text-sm text-zinc-600">Files go to Gofile via <code>POST /api/kb/upload</code> (server token). Only URL + metadata in Supabase <code>kb_files</code>. Supabase storage not used.</p>

        <p className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">Need help? The dashboard has a playground to test session + chat live without curl.</p>
      </article>
    </div>
  );
}
