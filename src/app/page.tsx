import Link from "next/link";
import { Sparkles, Database, MessageCircle, LayoutDashboard, ArrowRight, BookOpen } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthed = !!user;

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
            <span className="hidden rounded-full border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-neutral-400 sm:inline">
              Black & White
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/docs" className="hidden items-center gap-1.5 rounded-full border border-neutral-800 bg-black px-3 py-2 text-xs text-neutral-400 hover:text-white sm:flex">
              <BookOpen className="h-3 w-3" /> Docs
            </Link>
            {isAuthed ? (
              <>
                <span className="hidden max-w-[160px] truncate text-xs text-neutral-500 sm:inline">{user?.email}</span>
                <Link href="/dashboard" className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-neutral-200">
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-full border border-neutral-800 bg-black px-4 py-2 text-xs font-medium text-white hover:bg-neutral-900">
                  Sign in
                </Link>
                <Link href="/signup" className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-neutral-200">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1 text-xs font-medium text-neutral-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            Session-aware • {isAuthed ? `Signed in as ${user?.email}` : "Public"}
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Autonomous AI Support
            <span className="block text-neutral-500">for modern businesses</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-neutral-400 sm:text-base">
            Ingest knowledge, answer customers via RAG, auto-resolve tickets. <span className="text-white">Monochrome, fast, private.</span>
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {isAuthed ? (
              <>
                <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-sm font-semibold text-black hover:bg-neutral-200">
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/docs" className="inline-flex items-center gap-2 rounded-2xl border border-neutral-800 bg-black px-8 py-3.5 text-sm font-medium text-white hover:bg-neutral-950">
                  <BookOpen className="h-4 w-4" /> Docs
                </Link>
              </>
            ) : (
              <>
                <Link href="/signup" className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-sm font-semibold text-black hover:bg-neutral-200">
                  Get started <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/chat-demo" className="inline-flex items-center gap-2 rounded-2xl border border-neutral-800 bg-black px-8 py-3.5 text-sm font-medium text-white hover:bg-neutral-950">
                  <MessageCircle className="h-4 w-4" /> Try chat demo
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            { icon: Database, title: "Knowledge", desc: "URL or raw text/JSON → chunk → hy3 embed → pgvector.", href: "/ingest", cta: "Ingest" },
            { icon: MessageCircle, title: "AI Widget", desc: "RAG + GoFile screenshots + log_resolved_ticket tool.", href: "/chat-demo", cta: "Open widget" },
            { icon: LayoutDashboard, title: "Dashboard", desc: "Overview stats + tickets by priority + settings.", href: "/dashboard", cta: "Open dashboard" },
          ].map(({ icon: Icon, title, desc, href, cta }) => (
            <Link
              key={title}
              href={href}
              className="group rounded-[20px] border border-neutral-800 bg-neutral-950 p-6 transition hover:border-white hover:bg-black"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black group-hover:scale-105 transition">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold tracking-tight">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">{desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-neutral-400 group-hover:text-white">
                {cta} <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>

        <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
          <Link href="/docs" className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 hover:border-neutral-700">
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">Docs</p>
            <p className="mt-1 text-sm text-white">Full API & deployment guide → /docs</p>
            <p className="mt-1 text-xs text-neutral-500">Env vars, ingest, chat, wrangler, troubleshooting.</p>
          </Link>
          <div className="rounded-2xl border border-neutral-800 bg-black p-4">
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">Fast deploy</p>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-neutral-950 p-3 text-[11px] leading-relaxed text-neutral-300">
              {`npx wrangler pages deploy .open-next/assets --project-name repllyer`}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
