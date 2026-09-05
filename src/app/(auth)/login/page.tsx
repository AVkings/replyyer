"use client";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { motion } from "framer-motion";

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
    <div className="mx-auto max-w-sm px-6 py-16">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-semibold">Log in</h1>
        <p className="mt-1 text-sm text-zinc-600">Google sign-in only — fast, secure, no passwords.</p>
        <div className="mt-6 space-y-3">
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-zinc-200 bg-white py-3 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C34.7 32.1 29.6 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 2.9l6-6C34.5 5.1 29.4 3 24 3 12.3 3 3 12.3 3 24s9.3 21 21 21c10.5 0 20.1-7.6 20.1-21 0-1.4-.1-2.7-.3-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16.1 18.9 13 24 13c3.1 0 5.9 1.1 8 2.9l6-6C34.5 5.1 29.4 3 24 3 16.3 3 9.4 7 6.3 14.7z"/><path fill="#4CAF50" d="M24 45c5.4 0 10.2-1.8 14-4.9l-6.5-5.3C29.6 36 26.9 37.5 24 37.5c-5.6 0-10.3-3.8-12-8.9l-6.6 5.1C9.2 40.9 16.3 45 24 45z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3-3.7 5.5-7 6.8l6.5 5.3c.5-.5 8.5-6.2 8.5-16.6 0-1.4-.1-2.7-.3-3.5z"/></svg>
            {loading ? "Redirecting..." : "Continue with Google"}
          </button>
          <p className="text-center text-xs text-zinc-500">We’ll redirect to Google — then back to your dashboard.</p>
        </div>
        {msg && <p className="mt-3 text-xs text-red-600">{msg}</p>}
        <p className="mt-6 text-center text-xs text-zinc-500">
          No account yet? Google will create one automatically. <Link href="/signup" className="underline">Sign up</Link>
        </p>
      </motion.div>
    </div>
  );
}
