import IngestForm from "@/components/knowledge/IngestForm";
import { Database, Shield, Zap, Globe, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Ingest Knowledge — Repllyer",
  description: "Paste a URL and let Repllyer learn from it via embeddings",
};

export default function IngestPage() {
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
            <span className="rounded-full border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-neutral-400">
              Premium
            </span>
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
            <div className="mb-6">
              <h1 className="text-[28px] font-semibold tracking-tight">Knowledge Ingestion Engine</h1>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                Paste any public URL — docs, help center, Notion, blog. We scrape, chunk with overlap, embed via Kira{" "}
                <code className="rounded border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 text-xs text-white">hy3</code> and store in{" "}
                <code className="rounded border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 text-xs text-white">knowledge_bases</code> for RAG.
              </p>
            </div>

            <div className="rounded-[24px] border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
              <IngestForm />
              <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">API alternative</p>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-neutral-950 p-3 text-[11px] leading-relaxed text-neutral-300">
                  {`curl -X POST https://repllyer.pages.dev/api/ingest \\
  -H "Content-Type: application/json" \\
  -d '{ "url": "https://example.com/docs" }'`}
                </pre>
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-[24px] border border-neutral-800 bg-neutral-950 p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Zap className="h-4 w-4 text-white" /> How it works
              </h2>
              <ol className="mt-4 space-y-4">
                {[
                  { title: "Scrape & clean", desc: "Fetch HTML → cheerio strips scripts/styles/nav/footer, keeps headings, paragraphs, lists." },
                  { title: "Chunk with overlap", desc: "~700 chars per chunk, 100-char overlap. Sentence boundaries preserved." },
                  { title: "Embed via Kira hy3", desc: "Each chunk → createEmbedding() (OpenAI-compatible). One vector per row." },
                  { title: "Store + deduplicate", desc: "Deletes prior chunks for same url+org, then inserts with chunk_index." },
                ].map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-black">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{s.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{s.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid gap-3">
              {[
                { icon: Globe, label: "CORS-safe", desc: "Server-side fetch — no browser CORS. 15s timeout + 5MB guard." },
                { icon: Database, label: "pgvector HNSW", desc: "Cosine similarity via match_knowledge_bases RPC." },
                { icon: Shield, label: "Idempotent", desc: "Re-ingesting same URL replaces old chunks atomically." },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-xs leading-relaxed text-neutral-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-black p-4">
              <p className="text-xs font-medium text-white">Heads-up</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                Dimension mismatch →{" "}
                <code className="rounded border border-neutral-800 bg-neutral-950 px-1 py-0.5 text-white">alter table knowledge_bases alter column embedding type vector(N);</code>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
