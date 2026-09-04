"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

export function Navbar() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supa = createBrowserClient();
    supa.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || null);
      setLoading(false);
    });
    const { data: sub } = supa.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email || null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    await createBrowserClient().auth.signOut();
    window.location.href = "/";
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-black text-sm font-bold text-white">R</span>
          <span className="text-sm font-semibold tracking-tight">repllyer</span>
          <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-medium tracking-widest text-zinc-500">BETA</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm md:flex">
          <Link href="/docs" className="text-zinc-600 hover:text-black">Docs</Link>
          <Link href="/#pricing" className="text-zinc-600 hover:text-black">Pricing</Link>
          {!loading && userEmail ? (
            <>
              <span className="max-w-[180px] truncate text-xs text-zinc-500">{userEmail}</span>
              <Link href="/dashboard" className="rounded-full bg-black px-4 py-1.5 text-white hover:bg-zinc-800">Dashboard</Link>
              <button onClick={logout} className="rounded-full border border-zinc-200 px-4 py-1.5 hover:bg-zinc-50">Log out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-full border border-zinc-200 px-4 py-1.5 hover:bg-zinc-50">Log in</Link>
              <Link href="/signup" className="rounded-full bg-black px-4 py-1.5 text-white hover:bg-zinc-800">Get API key</Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 md:hidden">
          {userEmail ? (
            <Link href="/dashboard" className="rounded-full bg-black px-3 py-1.5 text-xs text-white">Dashboard</Link>
          ) : (
            <Link href="/login" className="text-sm font-medium">Log in</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
