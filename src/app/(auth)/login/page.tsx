"use client";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { motion } from "framer-motion";
import { EASE } from "@/components/motion";

export default function Login() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    setMsg("");
    const supa = createBrowserClient();
    const origin = window.location.origin;
    const { error } = await supa.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    });
    if (error) {
      setMsg(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: EASE }}
        className="rounded-3xl border border-zinc-200 bg-white/90 p-7 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.25)] backdrop-blur"
      >
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-black text-base font-bold text-white">R</div>
        <h1 className="mt-4 text-center text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-center text-sm text-zinc-600">Google sign-in only — fast, secure, no passwords.</p>
        <div className="mt-6 space-y-3">
          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            onClick={signInWithGoogle}
            disabled={loading}
            className="btn-shine flex w-full items-center justify-center gap-3 rounded-full border border-zinc-200 bg-white py-3 text-sm font-medium transition hover:border-black disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C34.7 32.1 29.6 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 2.9l6-6C34.5 5.1 29.4 3 24 3 12.3 3 3 12.3 3 24s9.3 21 21 21c10.5 0 20.1-7.6 20.1-21 0-1.4-.1-2.7-.3-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16.1 18.9 13 24 13c3.1 0 5.9 1.1 8 2.9l6-6C34.5 5.1 29.4 3 24 3 16.3 3 9.4 7 6.3 14.7z"/><path fill="#4CAF50" d="M24 45c5.4 0 10.2-1.8 14-4.9l-6.5-5.3C29.6 36 26.9 37.5 24 37.5c-5.6 0-10.3-3.8-12-8.9l-6.6 5.1C9.2 40.9 16.3 45 24 45z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3-3.7 5.5-7 6.8l6.5 5.3c.5-.5 8.5-6.2 8.5-16.6 0-1.4-.1-2.7-.3-3.5z"/></svg>
            {loading ? "Redirecting..." : "Continue with Google"}
          </motion.button>
          <p className="text-center text-xs text-zinc-500">We’ll redirect to Google — then back to your dashboard.</p>
        </div>
        {msg && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{msg}</p>}
        <ul className="mt-6 space-y-2 border-t border-zinc-100 pt-4 text-xs text-zinc-600">
          {["180 free credits on your first business", "Human-takeover inbox included", "Priority sorting out of the box"].map((f) => (
            <li key={f} className="flex gap-2"><span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-black text-[9px] text-white">✓</span>{f}</li>
          ))}
        </ul>
        <p className="mt-5 text-center text-xs text-zinc-500">
          No account yet? Google will create one automatically. <Link href="/signup" className="font-medium text-black underline">Sign up</Link>
        </p>
      </motion.div>
    </div>
  );
}
