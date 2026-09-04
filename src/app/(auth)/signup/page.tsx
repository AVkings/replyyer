"use client";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("...");
    const supa = createBrowserClient();
    const { error } = await supa.auth.signUp({ email, password });
    if (error) setMsg(error.message);
    else { setMsg("Check email or logging you in..."); const { error: e2 } = await supa.auth.signInWithPassword({ email, password }); if (!e2) router.push("/dashboard"); }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-xl font-semibold">Create account</h1>
      <p className="mt-1 text-sm text-zinc-600">Get 180 free messages on your first business.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="email" className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-black" />
        <input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" placeholder="password (6+ chars)" className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-black" />
        <button className="w-full rounded-full bg-black py-2.5 text-sm font-medium text-white hover:bg-zinc-800">Sign up</button>
      </form>
      {msg && <p className="mt-3 text-xs text-zinc-600">{msg}</p>}
      <p className="mt-4 text-xs text-zinc-500">Have account? <Link href="/login" className="underline">Log in</Link></p>
    </div>
  );
}
