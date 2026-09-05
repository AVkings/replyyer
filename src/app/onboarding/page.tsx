"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

const steps = [
  { n: 1, t: "Create your business", d: "Tell us what you sell — we generate your API key." },
  { n: 2, t: "Add knowledge", d: "Upload PDFs or paste Q&A so AI answers accurately." },
  { n: 3, t: "Connect & test", d: "Call https://repllyer.vercel.app — examples live in the docs." },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [biz, setBiz] = useState({ name: "", description: "" });
  const [msg, setMsg] = useState("");
  const [apiKey, setApiKey] = useState("");
  const router = useRouter();

  async function create() {
    const r = await fetch("/api/businesses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: biz.name, description: biz.description }) });
    const j = await r.json();
    if (r.ok) { setApiKey(j.api_key); setMsg("Done! Save your key."); setStep(2); }
    else setMsg(j.error || "error");
  }

  return (
    <div className="relative mx-auto max-w-3xl overflow-hidden px-6 py-10">
      <div className="animate-floaty pointer-events-none absolute -top-16 left-1/2 h-52 w-[30rem] -translate-x-1/2 rounded-full bg-zinc-200/70 blur-3xl" aria-hidden="true" />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to Repllyer</h1>
        <p className="mt-1 text-sm text-zinc-600">3 steps — animated, fast. Base URL <code className="font-mono">https://repllyer.vercel.app</code></p>
      </motion.div>

      <div className="mt-8 flex justify-center gap-2">
        {steps.map((s) => (
          <motion.div key={s.n} animate={{ scale: step === s.n ? 1.05 : 1 }} className={`h-2 w-16 rounded-full ${step >= s.n ? "bg-black" : "bg-zinc-200"}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold">Step 1 — {steps[0].t}</div>
            <p className="text-xs text-zinc-500">{steps[0].d} First business is free (180 credits). Next costs 100 credits.</p>
            <div className="mt-4 space-y-3">
              <input value={biz.name} onChange={(e)=>setBiz({ ...biz, name: e.target.value })} placeholder="Business name (e.g. Sweet Shop)" className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm" />
              <textarea value={biz.description} onChange={(e)=>setBiz({ ...biz, description: e.target.value })} placeholder="What do you sell? (used for AI prompt)" rows={3} className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm" />
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={create} className="w-full rounded-full bg-black py-3 text-sm font-medium text-white">Create & get API key</motion.button>
              {msg && <p className="text-xs text-zinc-600">{msg}</p>}
              {apiKey && <div className="break-all rounded-xl bg-zinc-950 p-3 font-mono text-xs text-lime-300">{apiKey}</div>}
            </div>
            <button onClick={() => setStep(2)} className="mt-4 text-xs underline">Skip →</button>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold">Step 2 — {steps[1].t}</div>
            <p className="text-xs text-zinc-500">{steps[1].d}</p>
            <div className="mt-4">
              <Link href="/dashboard/knowledge" className="inline-block rounded-full bg-black px-6 py-2.5 text-sm text-white">Add knowledge</Link>
              <button onClick={() => setStep(3)} className="ml-2 rounded-full border border-zinc-200 px-6 py-2.5 text-sm">Skip, test bot →</button>
            </div>
            {apiKey && <div className="mt-3 text-xs">Your key: <code className="font-mono">{apiKey.slice(0, 12)}••••</code></div>}
          </motion.div>
        )}
        {step === 3 && (
          <motion.div key="3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold">Step 3 — {steps[2].t}</div>
            <p className="text-xs text-zinc-500">No email needed — bot asks visitor or treats as guest. Session resets on page reload.</p>
            <pre className="mt-3 overflow-auto rounded-xl bg-zinc-950 p-4 text-xs text-zinc-300">{`curl -X POST https://repllyer.vercel.app/api/v1/session/init \\
  -H "x-api-key: ${apiKey || "rply_live_..."}" \\
  -d '{}' // guest ok`}</pre>
            <div className="mt-4 flex gap-2">
              <Link href="/docs#chat" className="rounded-full bg-black px-6 py-2.5 text-sm text-white">See live examples</Link>
              <Link href="/dashboard" className="rounded-full border border-zinc-200 px-6 py-2.5 text-sm">Go to dashboard</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
