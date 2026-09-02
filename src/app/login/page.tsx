import AuthForm from "@/components/auth/AuthForm";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Suspense } from "react";

export const metadata = { title: "Sign in — Repllyer" };

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
      </div>

      <header className="relative flex items-center justify-between px-6 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Repllyer</span>
          <span className="rounded-full border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-neutral-400">
            Black & White
          </span>
        </Link>
        <Link href="/signup" className="rounded-full border border-neutral-800 bg-white px-4 py-2 text-xs font-medium text-black hover:bg-neutral-200">
          Create account
        </Link>
      </header>

      <main className="relative mx-auto flex min-h-[calc(100vh-80px)] items-center justify-center px-6 py-10">
        <Suspense fallback={<div className="text-sm text-neutral-500">Loading…</div>}>
          <AuthForm mode="login" />
        </Suspense>
      </main>
    </div>
  );
}
