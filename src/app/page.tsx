"use client";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 grid-pattern opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs">
              <span className="h-2 w-2 animate-pulse rounded-full bg-black" /> API-first • Human takeover • 180 msgs free
            </div>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
              Customer care bot that <span className="bg-black px-2 text-white">doesn&apos;t suck</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-6 text-zinc-600">
              Give us what you sell, we generate an API key. Your bot forwards customer queries — auto-resolved or escalated by priority & topic. Later: email, voice.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800">Start free — 180 msgs</Link>
              <Link href="/docs" className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-medium hover:bg-zinc-50">Read docs</Link>
            </div>
            <div className="mt-10 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 text-left shadow-2xl">
              <div className="flex items-center gap-1 border-b border-zinc-800 px-4 py-2">
                <span className="h-3 w-3 rounded-full bg-zinc-700" /><span className="h-3 w-3 rounded-full bg-zinc-700" /><span className="h-3 w-3 rounded-full bg-zinc-700" />
                <span className="ml-2 text-xs font-mono text-zinc-500">curl — session + chat</span>
              </div>
              <motion.pre initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="overflow-x-auto p-5 text-xs leading-5 text-zinc-300">
{`# Base URL: https://repllyer.vercel.app
# 1. init session — no email needed (bot will ask, or treated as guest)
curl -X POST https://repllyer.vercel.app/api/v1/session/init \\
  -H "x-api-key: rply_live_..." -H "Content-Type: application/json" \\
  -d '{}'
# -> { "session_id": "uuid", "credits_remaining": 177, "guest": true }

# 2. chat
curl -X POST https://repllyer.vercel.app/api/v1/chat \\
  -H "x-api-key: rply_live_..." \\
  -d '{"session_id":"uuid","message":"refund not received?"}'
# -> { "status":"human_required","priority":"urgent","topic":"refund" }`}
              </motion.pre>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { n: "01", t: "Tell us what you sell", d: "Paste description + upload PDFs. We build your private knowledge base securely." },
            { n: "02", t: "Drop in 1 API key", d: "x-api-key header. We verify, check credits, create session on page load." },
            { n: "03", t: "Auto or human", d: "AI answers + classifies priority/topic. Unsolvable → your dashboard queue." },
          ].map((s, i) => (
            <motion.div key={s.n} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} whileHover={{ y: -4 }} className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="text-xs font-mono text-zinc-400">{s.n}</div>
              <div className="mt-2 text-sm font-semibold">{s.t}</div>
              <div className="mt-1 text-sm leading-5 text-zinc-600">{s.d}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Priority */}
      <section className="border-y border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-lg font-semibold">Priority that means something</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">Money & quality issues surface first. No more FIFO ticket hell.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              { p: "urgent", c: "bg-black text-white", d: "payment / refund / billing / legal" },
              { p: "high", c: "bg-zinc-900 text-white", d: "product defect / bug / delivery failure" },
              { p: "medium", c: "bg-white border border-zinc-200", d: "account / how-to / order status" },
              { p: "low", c: "bg-white border border-zinc-200", d: "general / feedback / greeting" },
            ].map((x) => (
              <div key={x.p} className={`rounded-xl px-4 py-4 text-sm ${x.c}`}>
                <div className="font-mono text-xs tracking-widest">{x.p}</div>
                <div className="mt-2 text-xs opacity-80">{x.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-lg font-semibold">Start free, pay as you grow</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-4">
          {[
            { name: "Free", price: "₹0", sub: "180 msgs", cta: "Get started", href: "/signup", feat: ["1 API key", "Knowledge base", "Human queue"] },
            { name: "500", price: "₹499", sub: "one-time pack", cta: "Buy credits", href: "/dashboard", feat: ["500 credits", "No expiry (1y)", "Priority topics"] },
            { name: "2,500", price: "₹1,999", sub: "most popular", cta: "Buy credits", href: "/dashboard", feat: ["2,500 credits", "Email alerts", "Webhook"] , popular: true},
            { name: "10,000", price: "₹6,999", sub: "scale", cta: "Buy credits", href: "/dashboard", feat: ["10k credits", "SLA + Analytics"] },
          ].map((p) => (
            <div key={p.name} className={`rounded-2xl border p-6 ${p.popular ? "border-black bg-black text-white" : "border-zinc-200 bg-white"}`}>
              <div className="text-xs font-mono tracking-widest opacity-60">{p.name}</div>
              <div className={`mt-1 text-2xl font-semibold ${p.popular ? "text-white" : "text-black"}`}>{p.price}</div>
              <div className={`text-xs ${p.popular ? "text-zinc-300" : "text-zinc-500"}`}>{p.sub}</div>
              <ul className="mt-4 space-y-1.5 text-xs">
                {p.feat.map((f) => <li key={f} className="flex gap-2"><span>—</span>{f}</li>)}
              </ul>
              <Link href={p.href} className={`mt-6 block rounded-full px-4 py-2 text-center text-xs font-medium ${p.popular ? "bg-white text-black" : "bg-black text-white"}`}>{p.cta}</Link>
            </div>
          ))}
        </div>
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="mt-4 text-xs text-zinc-500">Auto-credits on purchase. 1 credit = 1 message. Extra business = 100 credits. See docs for quickstart.</motion.p>
      </section>
    </div>
  );
}
