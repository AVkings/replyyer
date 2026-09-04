"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBiz } from "@/components/dashboard/BizContext";
import Link from "next/link";

export function OnboardingPopup() {
  const { bizs } = useBiz();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [biz, setBiz] = useState({ name: "", description: "" });
  const [apiKey, setApiKey] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const seen = typeof window !== "undefined" ? localStorage.getItem("repllyer_onboarded") : "true";
    if (!seen) {
      // show only if user has 0 businesses OR first time
      if (bizs.length === 0) setOpen(true);
      // if already has businesses but never onboarded, still show once
      if (bizs.length === 0) setOpen(true);
      else if (!seen) setOpen(true);
    }
    // also if bizs still loading, wait
    if (bizs.length === 0 && !seen) setOpen(true);
  }, [bizs]);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("repllyer_onboarded") === "true") setOpen(false);
  }, []);

  const dismiss = () => {
    localStorage.setItem("repllyer_onboarded", "true");
    setOpen(false);
  };

  async function create() {
    if (!biz.name.trim()) { setMsg("Name required"); return; }
    const r = await fetch("/api/businesses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: biz.name, description: biz.description }) });
    const j = await r.json();
    if (r.ok) { setApiKey(j.api_key); setMsg("Created! Save your key."); setStep(2); if (typeof window !== "undefined") localStorage.setItem("repllyer_onboarded", "true"); }
    else setMsg(j.error || "error");
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
        <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Welcome to Repllyer — quick setup</h2>
            <button onClick={dismiss} className="rounded-full border border-zinc-200 px-3 py-1 text-xs">Skip</button>
          </div>
          <div className="mt-3 flex gap-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`h-1.5 flex-1 rounded-full ${step >= n ? "bg-black" : "bg-zinc-200"}`} />
            ))}
          </div>

          {step === 1 && (
            <div className="mt-5 space-y-3">
              <div className="text-sm font-medium">Step 1 — Create your business</div>
              <p className="text-xs text-zinc-500">First business free (180 credits). Next = 100 credits. This shows only once.</p>
              <input value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} placeholder="Business name" className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm" />
              <textarea value={biz.description} onChange={(e) => setBiz({ ...biz, description: e.target.value })} placeholder="What do you sell? (AI uses this)" rows={3} className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm" />
              <motion.button whileTap={{ scale: 0.98 }} onClick={create} className="w-full rounded-full bg-black py-2.5 text-sm font-medium text-white">Create & get API key</motion.button>
              {msg && <p className="text-xs text-zinc-600">{msg}</p>}
              {apiKey && <div className="break-all rounded-xl bg-zinc-950 p-3 font-mono text-xs text-lime-300">{apiKey}</div>}
            </div>
          )}
          {step === 2 && (
            <div className="mt-5 space-y-3">
              <div className="text-sm font-medium">Step 2 — Add knowledge</div>
              <p className="text-xs text-zinc-500">Upload PDFs or paste Q&A from Settings → Knowledge.</p>
              <div className="flex gap-2">
                <Link href="/dashboard/knowledge" onClick={dismiss} className="rounded-full bg-black px-4 py-2 text-xs text-white">Go to Knowledge</Link>
                <button onClick={() => setStep(3)} className="rounded-full border border-zinc-200 px-4 py-2 text-xs">Next</button>
              </div>
              {apiKey && <div className="text-xs font-mono">Key: {apiKey.slice(0, 12)}•••• (copied once)</div>}
            </div>
          )}
          {step === 3 && (
            <div className="mt-5 space-y-3">
              <div className="text-sm font-medium">Step 3 — Connect at https://repllyer.vercel.app</div>
              <pre className="overflow-auto rounded-xl bg-zinc-950 p-3 text-xs text-zinc-300">{`curl -X POST https://repllyer.vercel.app/api/v1/session/init \\
  -H "x-api-key: ${apiKey ? apiKey.slice(0, 12) + "..." : "rply_live_..."}" \\
  -d '{}' // guest ok, bot asks email if needed`}</pre>
              <div className="flex gap-2">
                <button onClick={dismiss} className="rounded-full bg-black px-4 py-2 text-xs text-white">Done — go to dashboard</button>
                <Link href="/docs" onClick={dismiss} className="rounded-full border border-zinc-200 px-4 py-2 text-xs">Docs</Link>
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-between text-xs">
            {step > 1 ? <button onClick={() => setStep(step - 1)} className="text-zinc-500 underline">Back</button> : <span />}
            {step < 3 && apiKey ? <button onClick={() => setStep(step + 1)} className="rounded-full bg-zinc-100 px-3 py-1">Next →</button> : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
