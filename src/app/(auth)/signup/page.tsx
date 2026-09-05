"use client";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { motion } from "framer-motion";
import { EASE } from "@/components/motion";

export default function Signup() {
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
        <h1 className="mt-4 text-center text-xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-center text-sm text-zinc-600">One click with Google. <span className="font-semibold text-black">180 free messages</span> on your first business.</p>
        <div className="mt-6 space-y-3">
          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            onClick={signInWithGoogle}
            disabled={loading}
            className="btn-shine flex w-full items-center justify-center gap-3 rounded-full bg-black py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#fff" d="M43.6 20.5H42V20H24v8h11.3C34.7 32.1 29.6 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 2.9l6-6C34.5 5.1 29.4 3 24 3 12.3 3 3 12.3 3 24s9.3 21 21 21c10.5 0 20.1-7.6 20.1-21 0-1.4-.1-2.7-.3-3.5z"/></svg>
            {loading ? "Redirecting..." : "Continue with Google"}
          </motion.button>
          <p className="text-center text-xs text-zinc-500">No password needed. Google creates your account instantly.</p>
        </div>
        {msg && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{msg}</p>}
        <ul className="mt-6 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-4 text-center">
          {[["180", "free msgs"], ["1", "API key"], ["30cr", "script runs"]].map(([v, l]) => (
            <li key={l} className="rounded-xl bg-zinc-50 px-2 py-2.5">
              <div className="text-sm font-semibold">{v}</div>
              <div className="text-[10px] text-zinc-500">{l}</div>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-center text-xs text-zinc-500">
          Already have an account? <Link href="/login" className="font-medium text-black underline">Log in</Link>
        </p>
      </motion.div>
    </div>
  );
}
