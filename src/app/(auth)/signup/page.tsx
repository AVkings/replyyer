"use client";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { motion } from "framer-motion";

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
    <div className="mx-auto max-w-sm px-6 py-16">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-zinc-600">Google sign-in only. Get 180 free credits on your first business.</p>
        <div className="mt-6 space-y-3">
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-black py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#fff" d="M43.6 20.5H42V20H24v8h11.3C34.7 32.1 29.6 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 2.9l6-6C34.5 5.1 29.4 3 24 3 12.3 3 3 12.3 3 24s9.3 21 21 21c10.5 0 20.1-7.6 20.1-21 0-1.4-.1-2.7-.3-3.5z"/></svg>
            {loading ? "Redirecting..." : "Continue with Google"}
          </button>
          <p className="text-center text-xs text-zinc-500">No password needed. Google creates your account instantly.</p>
        </div>
        {msg && <p className="mt-3 text-xs text-red-600">{msg}</p>}
        <p className="mt-6 text-center text-xs text-zinc-500">
          Already have an account? <Link href="/login" className="underline">Log in</Link>
        </p>
      </motion.div>
    </div>
  );
}
