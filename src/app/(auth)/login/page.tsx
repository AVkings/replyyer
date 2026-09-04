"use client";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("...");
    const supa = createBrowserClient();
    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    else router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-xl font-semibold">Log in</h1>
      <p className="mt-1 text-sm text-zinc-600">White & black, animative — as requested.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="email" className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-black" />
        <input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" placeholder="password" className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-black" />
        <button className="w-full rounded-full bg-black py-2.5 text-sm font-medium text-white hover:bg-zinc-800">Log in</button>
      </form>
      {msg && <p className="mt-3 text-xs text-zinc-600">{msg}</p>}
      <p className="mt-4 text-xs text-zinc-500">No account? <Link href="/signup" className="underline">Sign up</Link></p>
    </div>
  );
}
