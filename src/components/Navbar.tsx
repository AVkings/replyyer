"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createBrowserClient } from "@/lib/supabase-browser";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group relative text-zinc-600 transition hover:text-black">
      {children}
      <span className="absolute -bottom-1 left-0 h-px w-0 bg-black transition-all duration-300 group-hover:w-full" />
    </Link>
  );
}

export function Navbar() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supa = createBrowserClient();
    supa.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || null);
      setLoading(false);
    });
    const { data: sub } = supa.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email || null);
    });
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  async function logout() {
    await createBrowserClient().auth.signOut();
    window.location.href = "/";
  }

  return (
    <nav className={`sticky top-0 z-50 border-b bg-white/80 backdrop-blur transition-shadow ${scrolled ? "border-zinc-200 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)]" : "border-transparent"}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="group flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-black text-sm font-bold text-white transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105">R</span>
          <span className="text-sm font-semibold tracking-tight">repllyer</span>
          <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-medium tracking-widest text-zinc-500">BETA</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm md:flex">
          <NavLink href="/docs">Docs</NavLink>
          <NavLink href="/#pricing">Pricing</NavLink>
          {!loading && userEmail ? (
            <>
              <span className="max-w-[180px] truncate text-xs text-zinc-500">{userEmail}</span>
              <Link href="/dashboard" className="btn-shine rounded-full bg-black px-4 py-1.5 text-white transition hover:bg-zinc-800">Dashboard</Link>
              <button onClick={logout} className="rounded-full border border-zinc-200 px-4 py-1.5 transition hover:border-black">Log out</button>
            </>
          ) : (
            <>
              <NavLink href="/docs">Docs</NavLink>
              <Link href="/login" className="rounded-full border border-zinc-200 px-4 py-1.5 transition hover:border-black">Log in</Link>
              <Link href="/signup" className="btn-shine rounded-full bg-black px-4 py-1.5 text-white transition hover:bg-zinc-800">Get API key</Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 md:hidden">
          {userEmail ? (
            <Link href="/dashboard" className="rounded-full bg-black px-3 py-1.5 text-xs text-white">Dashboard</Link>
          ) : (
            <Link href="/login" className="text-sm font-medium">Log in</Link>
          )}
          <button onClick={() => setOpen((v) => !v)} aria-label="Toggle menu" aria-expanded={open} className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200">
            <span className="text-base leading-none">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-zinc-100 bg-white md:hidden"
          >
            <div className="space-y-1 px-6 py-4 text-sm">
              {[
                { href: "/docs", label: "Docs" },
                { href: "/#pricing", label: "Pricing" },
                { href: "/#scripts", label: "Scripts" },
                { href: "/#faq", label: "FAQ" },
                ...(userEmail
                  ? [{ href: "/dashboard", label: "Dashboard" }]
                  : [
                      { href: "/signup", label: "Get API key" },
                      { href: "/onboarding", label: "Onboarding" },
                    ]),
              ].map((l) => (
                <Link key={l.href + l.label} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-zinc-700 transition hover:bg-zinc-50 hover:text-black">
                  {l.label}
                </Link>
              ))}
              {userEmail && (
                <button onClick={logout} className="block w-full rounded-lg px-3 py-2 text-left text-zinc-700 transition hover:bg-zinc-50">
                  Log out
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
