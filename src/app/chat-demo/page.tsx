import AIChatWidget from "@/components/chat/AIChatWidget";
import Link from "next/link";
import { Code2, Sparkles, ArrowRight, Shield, Zap, Database, Image as ImageIcon } from "lucide-react";

export const metadata = {
  title: "Chat Demo — Repllyer",
  description: "Test the embeddable AI chat widget with RAG, GoFile uploads and auto-resolved tickets",
};

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-black">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-widest text-neutral-500">{label}</span>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-neutral-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function ChatDemoPage() {
  const iframeCode = `<iframe
  src="https://repllyer.pages.dev/chat-demo?embed=1"
  width="400"
  height="560"
  style="border:0; border-radius:28px"
  allow="clipboard-read; clipboard-write"
></iframe>`;

  const scriptCode = `<!-- Repllyer embed — drop anywhere -->
<script
  src="https://repllyer.pages.dev/widget.js"
  data-org="YOUR_ORGANIZATION_ID"
  data-title="Repllyer Support"
  async
></script>`;

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
            <span className="rounded-full border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-neutral-400">B&W</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="hidden text-xs text-neutral-500 hover:text-white sm:inline">
              Dashboard
            </Link>
            <Link href="/" className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-white">
              Home <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <h1 className="text-[28px] font-semibold tracking-tight">
              AI Chat Widget <span className="ml-2 rounded-full border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-xs font-medium text-neutral-400">Live RAG</span>
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Embeddable. Uses <code className="rounded border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 text-xs text-white">match_knowledge_bases</code> RPC,{" "}
              <code className="rounded border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 text-xs text-white">hy3</code> with{" "}
              <code className="rounded border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 text-xs text-white">log_resolved_ticket</code> tool, and GoFile.
            </p>

            <div className="mt-6 rounded-[32px] border border-neutral-800 bg-neutral-950 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-neutral-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                Inline preview — this is the component businesses embed
              </p>
              <AIChatWidget variant="inline" defaultOpen title="Repllyer Support" subtitle="AI • RAG + tickets • GoFile" />
            </div>

            <div className="mt-6 rounded-[24px] border border-neutral-800 bg-neutral-950 p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Zap className="h-4 w-4 text-white" /> Tool-calling flow
              </h2>
              <ol className="mt-4 space-y-3">
                {[
                  "User message → embeds query & calls match_knowledge_bases (top 5, threshold 0.3 fallback).",
                  "System prompt = instruction + RAG context + attachment hint. Call Kira hy3 with tool enabled.",
                  "If resolved → tool_call { issue_title, ai_summary, priority_level }.",
                  "Server catches → handleLogResolvedTicket() → inserts tickets auto_resolved → follow-up completion.",
                  "Client shows ticket badge + sources; dashboard lists by priority.",
                ].map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-black">{i + 1}</span>
                    <span className="text-xs leading-relaxed text-neutral-400">{t}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-[24px] border border-neutral-800 bg-neutral-950 p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Code2 className="h-4 w-4 text-white" /> Embed in your site
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                Test at <code className="rounded border border-neutral-800 bg-black px-1 py-0.5 text-white">/chat-demo</code>. Core component{" "}
                <code className="rounded border border-neutral-800 bg-black px-1 py-0.5 text-white">AIChatWidget.tsx</code> standalone.
              </p>
              <div className="mt-4 space-y-3">
                <CodeBlock label="iframe (simplest)" code={iframeCode} />
                <CodeBlock label="script tag (future widget.js)" code={scriptCode} />
              </div>
            </div>

            <div className="grid gap-3">
              {[
                { icon: Database, title: "RAG", desc: "query → hy3 embedding → RPC → top 5 chunks in system prompt." },
                { icon: ImageIcon, title: "Attachments", desc: "Paperclip → /api/upload → GoFile repllyer folder → attachment_url." },
                { icon: Shield, title: "Persistence", desc: "Creates/finds conversation, inserts messages for dashboard." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{title}</p>
                    <p className="text-xs leading-relaxed text-neutral-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-xs font-medium text-white">Try it</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                1) Ingest at <Link href="/ingest" className="text-white underline decoration-neutral-700">/ingest</Link>. 2) Ask about that content. 3) Upload screenshot. 4) Ticket with{" "}
                <code className="rounded border border-neutral-800 bg-black px-1 text-white">auto_resolved</code> appears in dashboard.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-black p-4">
              <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">API</p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-neutral-950 p-3 text-[11px] leading-relaxed text-neutral-300">
                {`POST /api/chat
{
  "messages": [{ "role":"user","content":"..." }],
  "organizationId": "uuid",
  "sessionId": "sess_...",
  "attachment_url": "https://..."
}`}
              </pre>
            </div>
          </div>
        </div>
      </main>

      <AIChatWidget variant="floating" defaultOpen={false} title="Repllyer (floating)" subtitle="Try me — floating" />
    </div>
  );
}
