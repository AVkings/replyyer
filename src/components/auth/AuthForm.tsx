"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureOrganizationForUser } from "@/lib/auth/actions";
import Link from "next/link";

type Mode = "login" | "signup";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [toast, setToast] = useState<{ type: "error" | "success"; message: string; details?: string } | null>(null);

  const isSignup = mode === "signup";

  const validate = () => {
    if (!email.trim() || !password) {
      setToast({ type: "error", message: "Email and password are required." });
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setToast({ type: "error", message: "Enter a valid email address." });
      return false;
    }
    if (password.length < 6) {
      setToast({ type: "error", message: "Password must be at least 6 characters." });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsPending(true);
    setToast(null);

    const supabase = getSupabaseBrowserClient();

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          },
        });
        if (error) throw new Error(error.message);

        // If user is immediately available (email confirm disabled), create org
        if (data.user) {
          // Ensure org — server will link to user.id
          const orgResult = await ensureOrganizationForUser();
          if ("error" in orgResult) {
            console.warn("Org creation warning:", orgResult.error);
          }
        }

        if (data.user && !data.user.email_confirmed_at && data.user.identities?.length) {
          // Check if email confirmation required: session may be null
          setToast({
            type: "success",
            message: "Account created. Check your email to confirm, then log in.",
          });
          setIsPending(false);
          return;
        }

        setToast({ type: "success", message: "Account created. Redirecting…" });
        router.push(nextPath);
        router.refresh();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw new Error(error.message);

        // Ensure org exists for existing users (idempotent)
        await ensureOrganizationForUser().catch(() => {});

        setToast({ type: "success", message: "Signed in. Redirecting…" });
        router.push(nextPath);
        router.refresh();
      }
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="w-full max-w-[420px]">
      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-8 shadow-2xl backdrop-blur-md"
      >
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-black">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">Repllyer</p>
            <p className="text-xs text-neutral-500">{isSignup ? "Create your account" : "Welcome back"}</p>
          </div>
        </div>

        <h1 className="text-[22px] font-semibold tracking-tight text-white">{isSignup ? "Create account" : "Sign in"}</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          {isSignup ? "Email and password only. An organization and API key will be created automatically." : "Use your email and password to access the dashboard."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-medium uppercase tracking-widest text-neutral-400">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-2xl border border-neutral-800 bg-black py-3.5 pl-10 pr-4 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-white focus:ring-4 focus:ring-white/10 disabled:opacity-60"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-medium uppercase tracking-widest text-neutral-400">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-neutral-800 bg-black py-3.5 pl-10 pr-11 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-white focus:ring-4 focus:ring-white/10 disabled:opacity-60"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-neutral-500 hover:bg-neutral-900 hover:text-white"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {isSignup && <p className="text-xs text-neutral-500">Minimum 6 characters. API key is shown only in Settings after login.</p>}
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            whileHover={{ scale: isPending ? 1 : 1.01 }}
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isSignup ? "Creating account…" : "Signing in…"}
              </>
            ) : (
              <>
                {isSignup ? "Create account" : "Sign in"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </motion.button>
        </form>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`mt-4 flex gap-2.5 rounded-2xl border px-4 py-3 text-xs leading-relaxed ${
                toast.type === "error"
                  ? "border-neutral-800 bg-black text-red-300"
                  : "border-neutral-800 bg-black text-emerald-300"
              }`}
            >
              {toast.type === "error" ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
              <span>
                {toast.message}
                {toast.details && <span className="block text-neutral-500">{toast.details}</span>}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-6 text-center text-sm text-neutral-500">
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-white underline decoration-neutral-700 underline-offset-4 hover:decoration-white">
            {isSignup ? "Sign in" : "Create account"}
          </Link>
        </p>
      </motion.div>

      <p className="mt-6 text-center text-xs text-neutral-600">
        No Google, no phone — email & password only. Your API key is only visible in dashboard settings.
      </p>
    </div>
  );
}
