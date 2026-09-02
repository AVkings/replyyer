import Link from "next/link";
import { BookOpen, Database, MessageCircle, Settings, Rocket, Key, FileText, Code2, AlertTriangle, Sparkles, ArrowRight, Copy } from "lucide-react";

export const metadata = { title: "Docs — Repllyer", description: "Repllyer documentation — API, ingest, chat, deployment" };

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-xl border border-neutral-800 bg-black p-3 text-xs leading-relaxed text-neutral-300">{children}</pre>;
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-neutral-800 bg-neutral-950 p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white">
        <Icon className="h-4 w-4" /> {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-neutral-400">{children}</div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
      </div>

      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Repllyer</span>
            <span className="rounded-full border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-[10px] uppercase tracking-widest text-neutral-500">Docs</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="rounded-full border border-neutral-800 bg-black px-4 py-2 text-xs text-white hover:bg-neutral-900">
              Dashboard
            </Link>
            <Link href="/" className="text-xs text-neutral-500 hover:text-white">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1 text-xs text-neutral-500">
            <BookOpen className="h-3 w-3" /> Repllyer Docs — Black & White Premium
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Build with Repllyer</h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-500">
            Autonomous AI support & CRM. Knowledge ingestion (URL or raw text/JSON), RAG chat with GoFile uploads, auto-resolved tickets, dashboard triage.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/ingest" className="rounded-2xl bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-neutral-200">
              Ingest
            </Link>
            <Link href="/chat-demo" className="rounded-2xl border border-neutral-800 bg-black px-5 py-2.5 text-sm text-white hover:bg-neutral-900">
              Chat Demo
            </Link>
            <Link href="/dashboard" className="rounded-2xl border border-neutral-800 bg-black px-5 py-2.5 text-sm text-white hover:bg-neutral-900">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-6 lg:grid-cols-2">
          <Section icon={Database} title="1. Knowledge Ingestion">
            <p>Two sources, same pipeline: URL scrape (cheerio, strips nav/script, HNSW) or raw paste (text/JSON/CSV/DB dump).</p>
            <ul className="list-disc pl-5 text-xs space-y-1">
              <li>Chunk 700 chars + 100 overlap, sentence-aware, max 120 chunks</li>
              <li>Embedding via Kira <code className="rounded border border-neutral-800 bg-black px-1 text-white">hy3</code> → <code className="bg-black border border-neutral-800 px-1 rounded text-white">knowledge_bases</code> (vector 1536)</li>
              <li>Idempotent: re-ingest same URL replaces chunks</li>
              <li>Dashboard: <code className="bg-black border border-neutral-800 px-1 rounded text-white">/dashboard/settings</code> has Org-scoped form</li>
            </ul>
            <Code>{`# URL
curl -X POST https://repllyer.pages.dev/api/ingest \\
 -H "Content-Type: application/json" \\
 -d '{"url":"https://example.com/docs","organizationId":"<uuid>"}'

# Raw text (new)
curl -X POST https://repllyer.pages.dev/api/ingest \\
 -H "Content-Type: application/json" \\
 -d '{"text":"Paste any docs here...","title":"My KB","organizationId":"<uuid>"}'`}</Code>
          </Section>

          <Section icon={MessageCircle} title="2. Chat Widget (RAG + Tool)">
            <p>
              <code className="bg-black border border-neutral-800 px-1 rounded text-white">POST /api/chat</code> does: embed last user message →{" "}
              <code className="bg-black border border-neutral-800 px-1 rounded text-white">match_knowledge_bases</code> (threshold 0.3, fallback debug) → inject context →{" "}
              <code className="bg-black border border-neutral-800 px-1 rounded text-white">hy3</code> with{" "}
              <code className="bg-black border border-neutral-800 px-1 rounded text-white">log_resolved_ticket</code> tool.
            </p>
            <ul className="list-disc pl-5 text-xs space-y-1">
              <li>Tool args: <code className="bg-black border border-neutral-800 px-1 rounded text-white">issue_title</code>, <code className="bg-black border border-neutral-800 px-1 rounded text-white">ai_summary</code>, <code className="bg-black border border-neutral-800 px-1 rounded text-white">priority_level 1-5</code></li>
              <li>Handler inserts <code className="bg-black border border-neutral-800 px-1 rounded text-white">tickets</code> auto_resolved + marks conversation resolved</li>
              <li>GoFile: <code className="bg-black border border-neutral-800 px-1 rounded text-white">POST /api/upload</code> (FormData file → repllyer folder → url), then sent as <code className="bg-black border border-neutral-800 px-1 rounded text-white">attachment_url</code></li>
              <li>Embed: <code className="bg-black border border-neutral-800 px-1 rounded text-white">&lt;AIChatWidget variant=&quot;floating|inline&quot; organizationId=&quot;uuid&quot; /&gt;</code> or iframe <code className="bg-black border border-neutral-800 px-1 rounded text-white">/chat-demo</code></li>
            </ul>
            <Code>{`fetch("/api/chat",{
  method:"POST",
  body: JSON.stringify({
    messages:[{role:"user",content:"How to reset pwd?"}],
    organizationId:"<uuid>", sessionId:"sess_123",
    attachment_url:"https://..."
  })
})`}</Code>
          </Section>

          <Section icon={Settings} title="3. Dashboard CRM">
            <ul className="list-disc pl-5 text-xs space-y-1">
              <li><code className="bg-black border border-neutral-800 px-1 rounded text-white">/dashboard</code> — stats: Total, Auto-Resolved %, Active (animated counters)</li>
              <li><code className="bg-black border border-neutral-800 px-1 rounded text-white">/dashboard/tickets</code> — sorted <code className="bg-black border border-neutral-800 px-1 rounded text-white">priority_level DESC</code>, filters, View Chat, Take Over → escalated</li>
              <li><code className="bg-black border border-neutral-800 px-1 rounded text-white">/dashboard/settings</code> — shows Org name/domain, <code className="bg-black border border-neutral-800 px-1 rounded text-white">api_key</code> (copy, only after login), ingest form</li>
              <li>Auth: Supabase email/password only, middleware protects <code className="bg-black border border-neutral-800 px-1 rounded text-white">/dashboard/*</code>, session persists (home shows Dashboard when authed)</li>
            </ul>
            <p className="text-xs">DB: <code className="bg-black border border-neutral-800 px-1 rounded text-white">organizations (owner_id)</code>, <code className="bg-black border border-neutral-800 px-1 rounded text-white">knowledge_bases</code>, <code className="bg-black border border-neutral-800 px-1 rounded text-white">conversations</code>, <code className="bg-black border border-neutral-800 px-1 rounded text-white">messages</code>, <code className="bg-black border border-neutral-800 px-1 rounded text-white">tickets</code> with RLS.</p>
          </Section>

          <Section icon={Key} title="4. Env Vars">
            <Code>{`NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey... (secret)
KIRA_API_KEY=kira_... (secret)
KIRA_BASE_URL=https://kiraai.vn/api/v1
KIRA_MODEL=hy3
GOFILE_API_TOKEN=... (secret)
GOFILE_FOLDER_ID=...
NEXT_PUBLIC_APP_URL=https://repllyer.pages.dev`}</Code>
            <p className="text-xs">Local: <code className="bg-black border border-neutral-800 px-1 rounded text-white">.env.local</code> + <code className="bg-black border border-neutral-800 px-1 rounded text-white">.dev.vars</code> (wrangler). Prod: Pages/Workers Dashboard → Variables and Secrets (mark secrets as Encrypted).</p>
          </Section>

          <Section icon={Rocket} title="5. Deployment — Pages (fast, free)">
            <p className="text-xs font-medium text-white">Fast path (recommended, no local build): Connect GitHub → Cloudflare Pages auto-builds.</p>
            <ol className="list-decimal pl-5 text-xs space-y-1">
              <li>Push to GitHub</li>
              <li>Dash → Workers & Pages → Create → Pages → Connect to Git → repllyer</li>
              <li>Build: Framework Next.js, Build cmd <code className="bg-black border border-neutral-800 px-1 rounded text-white">npm run build</code>, Output not needed (auto)</li>
              <li>Add env vars in Pages → Settings → Variables and Secrets</li>
              <li>Deploy → <code className="bg-black border border-neutral-800 px-1 rounded text-white">https://repllyer.pages.dev</code></li>
            </ol>
            <p className="text-xs font-medium text-white mt-3">Local wrangler (as you pasted):</p>
            <Code>{`npm i -g wrangler
wrangler login
npm run build
npx wrangler pages project create repllyer --production-branch main
npx wrangler pages deploy .vercel/output/static --project-name repllyer --branch main
# or if using OpenNext assets:
npx wrangler pages deploy .open-next/assets --project-name repllyer`}</Code>
            <p className="text-xs">Wrangler needs <code className="bg-black border border-neutral-800 px-1 rounded text-white">pages_build_output_dir = ".vercel/output/static"</code> in <code className="bg-black border border-neutral-800 px-1 rounded text-white">wrangler.toml</code> (already fixed). Don’t use <code className="bg-black border border-neutral-800 px-1 rounded text-white">[assets]</code> for Pages.</p>
          </Section>

          <Section icon={Rocket} title="6. Deployment — Workers via OpenNext (Next 16)">
            <p className="text-xs">For Next 16.3.4, Pages via <code className="bg-black border border-neutral-800 px-1 rounded text-white">@cloudflare/next-on-pages</code> is deprecated & incompatible (peer ≤15.5.2). Use Workers via OpenNext.</p>
            <Code>{`npm i -D @opennextjs/cloudflare
# wrangler.jsonc already created by migrate
npm run build        # next build
npx opennextjs-cloudflare build   # 30-40s, Windows slows (use WSL for speed)
npx opennextjs-cloudflare deploy  # deploys to Workers (≈11 MiB handler)
# Free Workers limit is 3 MiB → you hit size limit (11.8 MiB). Fix:
#  - Upgrade to Workers Paid ($5) for 10 MiB, OR
#  - Use Pages Git deploy (no size limit on build), OR
#  - Stay on Pages with static deploy: npx wrangler pages deploy`}</Code>
            <p className="text-xs text-neutral-500">Why slow on Windows? OpenNext warns: not fully compatible with Windows, use WSL for 2-3x speed. The 40s asset upload is normal (40 files, gzip 4 MiB).</p>
          </Section>

          <Section icon={FileText} title="7. Ingest — Text / DB">
            <p>Now supports <code className="bg-black border border-neutral-800 px-1 rounded text-white">URL</code> + <code className="bg-black border border-neutral-800 px-1 rounded text-white">Raw Text/JSON/CSV</code>. Paste a Notion export, DB dump, FAQ JSON, or free-form docs.</p>
            <Code>{`// Raw text ingest via UI (/ingest → Paste tab)
// or API:
curl -X POST .../api/ingest -d '{"text":"{\"faqs\":[{\"q\":\"...\",\"a\":\"...\"}]}","title":"FAQs"}'`}</Code>
            <p className="text-xs">In <code className="bg-black border border-neutral-800 px-1 rounded text-white">/ingest</code> and <code className="bg-black border border-neutral-800 px-1 rounded text-white">/dashboard/settings</code> you now see two tabs: URL and Paste. Both chunk → embed → pgvector.</p>
          </Section>

          <Section icon={AlertTriangle} title="8. Troubleshooting">
            <ul className="list-disc pl-5 text-xs space-y-1">
              <li><code className="bg-black border border-neutral-800 px-1 rounded text-white">Must specify directory</code> → add directory: <code className="bg-black border border-neutral-800 px-1 rounded text-white">npx wrangler pages deploy ./dist --project-name repllyer</code> or set <code className="bg-black border border-neutral-800 px-1 rounded text-white">pages_build_output_dir</code></li>
              <li><code className="bg-black border border-neutral-800 px-1 rounded text-white">does not support &quot;assets&quot;</code> → remove <code className="bg-black border border-neutral-800 px-1 rounded text-white">[assets]</code> from <code className="bg-black border border-neutral-800 px-1 rounded text-white">wrangler.toml</code> for Pages (kept only for Workers)</li>
              <li><code className="bg-black border border-neutral-800 px-1 rounded text-white">Worker exceeded 3 MiB</code> → upgrade Workers Paid or use Pages Git deploy</li>
              <li><code className="bg-black border border-neutral-800 px-1 rounded text-white">middleware deprecated</code> → migrated to <code className="bg-black border border-neutral-800 px-1 rounded text-white">src/proxy.ts</code> (already fixed, build clean)</li>
              <li>Slow build → use WSL, or <code className="bg-black border border-neutral-800 px-1 rounded text-white">npm run build</code> locally then let Pages build remotely (faster)</li>
              <li>Login button still shows when authed → fixed: home is now <code className="bg-black border border-neutral-800 px-1 rounded text-white">force-dynamic</code> with <code className="bg-black border border-neutral-800 px-1 rounded text-white">supabase.auth.getUser()</code> → shows Dashboard/email</li>
            </ul>
          </Section>
        </div>

        <div className="mx-auto mt-8 max-w-6xl flex justify-center gap-3">
          <Link href="/dashboard" className="rounded-2xl bg-white px-6 py-3 text-sm font-medium text-black hover:bg-neutral-200">
            Go to Dashboard <ArrowRight className="h-4 w-4 inline ml-1" />
          </Link>
          <Link href="/ingest" className="rounded-2xl border border-neutral-800 bg-black px-6 py-3 text-sm text-white hover:bg-neutral-900">
            Ingest new KB
          </Link>
        </div>
      </main>
    </div>
  );
}
