"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = "https://repllyer.vercel.app";

export default function TestBot() {
  const [apiKey, setApiKey] = useState("");
  const [session, setSession] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; text: string; meta?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight); }, [msgs]);

  async function init() {
    if (!apiKey.trim()) return setStatus("Paste your rply_live_... key first");
    setLoading(true); setStatus("Creating guest session...");
    const r = await fetch(`${BASE}/api/v1/session/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey.trim() },
      body: JSON.stringify({}),
    });
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) return setStatus(j.error || "init failed — check key/balance");
    setSession(j.session_id);
    setStatus(`Session ready (${j.guest ? "guest — bot will ask for email" : "identified"}) • ${j.credits_remaining} credits left`);
    setMsgs([{ role: "assistant", text: "Hi! I'm your Repllyer bot. Ask me anything — if I can't help, a human will take over." }]);
  }

  async function send() {
    if (!input.trim() || !session) return;
    const text = input.trim();
    setInput("");
    setMsgs((m) => [...m, { role: "user", text }]);
    setLoading(true);
    const r = await fetch(`${BASE}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey.trim() },
      body: JSON.stringify({ session_id: session, message: text }),
    });
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) {
      setMsgs((m) => [...m, { role: "assistant", text: j.error || "error", meta: String(r.status) }]);
      if (r.status === 410) { setSession(null); setStatus("Session expired — re-init"); }
      return;
    }
    setMsgs((m) => [...m, { role: "assistant", text: j.answer, meta: `${j.priority} • ${j.topic} • ${j.status}` }]);
    setStatus(`${j.status} • ${j.credits_remaining} credits left`);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 grid gap-6 md:grid-cols-[360px_1fr]">
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="rounded-2xl border border-zinc-200 bg-white p-5 h-fit">
        <h1 className="text-lg font-semibold">Test your bot</h1>
        <p className="mt-1 text-xs text-zinc-500">Live via <code className="font-mono">https://repllyer.vercel.app</code> — no curl.</p>
        <div className="mt-4 space-y-3">
          <input value={apiKey} onChange={(e)=>setApiKey(e.target.value)} placeholder="rply_live_..." className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-mono" />
          {!session ? (
            <motion.button whileTap={{ scale: 0.98 }} onClick={init} disabled={loading} className="w-full rounded-full bg-black py-2.5 text-sm font-medium text-white disabled:opacity-50">{loading ? "Starting..." : "Start guest session — no email needed"}</motion.button>
          ) : (
            <button onClick={() => { setSession(null); setMsgs([]); setStatus("Ended"); }} className="w-full rounded-full border border-zinc-200 py-2 text-xs">End session (reload clears it)</button>
          )}
          <p className="text-xs text-zinc-500">{status}</p>
          <div className="rounded-xl bg-zinc-50 p-3 text-xs leading-5">
            <div className="font-semibold">How it works</div>
            <div className="mt-1 text-zinc-600">1. Paste key → 2. Guest session auto-created → 3. Chat → AI auto or <code>human_required</code> with priority/topic.</div>
            <div className="mt-2 font-mono text-[11px] break-all">POST {BASE}/api/v1/session/init<br/>POST {BASE}/api/v1/chat</div>
          </div>
          <a href="/docs" className="block text-center text-xs underline">Read full docs</a>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-black text-xs font-bold text-white">R</span>
            <div>
              <div className="text-sm font-semibold">Repllyer Bot</div>
              <div className="text-xs text-zinc-500">{session ? "connected" : "not connected"}</div>
            </div>
          </div>
          <span className={`h-2 w-2 rounded-full ${session ? "bg-green-500 animate-pulse" : "bg-zinc-300"}`} />
        </div>

        <div ref={ref} className="flex-1 overflow-y-auto bg-zinc-50 p-4 space-y-3">
          <AnimatePresence>
            {msgs.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-black text-white rounded-br-sm" : "bg-white border border-zinc-200 rounded-bl-sm"}`}>
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  {m.meta && <div className="mt-1 text-[11px] opacity-60">{m.meta}</div>}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {msgs.length === 0 && <div className="py-16 text-center text-xs text-zinc-500">Start a session to chat. Try: "my payment failed" (→ urgent).</div>}
          {loading && <div className="text-xs text-zinc-500">typing…</div>}
        </div>

        <div className="flex gap-2 border-t border-zinc-200 p-3">
          <input value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=> e.key === "Enter" && send()} placeholder={session ? "Type a message..." : "Start session first"} disabled={!session} className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm disabled:bg-zinc-50" />
          <motion.button whileTap={{ scale: 0.97 }} onClick={send} disabled={!session || loading} className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50">Send</motion.button>
        </div>
      </motion.div>
    </div>
  );
}
