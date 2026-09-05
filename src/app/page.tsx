"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CountUp, Item, Marquee, Reveal, Stagger, EASE } from "@/components/motion";
import { CopyButton } from "@/components/CopyButton";

const CURL_SNIPPET = `# Base URL: https://repllyer.vercel.app
# 1. init session — no email needed (bot will ask, or treated as guest)
curl -X POST https://repllyer.vercel.app/api/v1/session/init \\
  -H "x-api-key: rply_live_..." -H "Content-Type: application/json" \\
  -d '{}'
# -> { "session_id": "uuid", "credits_remaining": 177, "guest": true }

# 2. chat
curl -X POST https://repllyer.vercel.app/api/v1/chat \\
  -H "x-api-key: rply_live_..." \\
  -d '{"session_id":"uuid","message":"refund not received?"}'
# -> { "status":"human_required","priority":"urgent","topic":"refund" }`;

const DEMO_SCRIPT = [
  { role: "user", text: "refund not received, payment deducted?" },
  { role: "assistant", text: "Checking your order against our records…", meta: "urgent • refund" },
  { role: "assistant", text: "Refund issue confirmed — I've looped in a human specialist. Could you share your email so we can reach you?", meta: "human_required" },
  { role: "user", text: "my email is aarav@example.com" },
  { role: "assistant", text: "Saved. A specialist replies within the hour. Anything else?", meta: "resolved" },
] as const;

function LiveDemo() {
  const [n, setN] = useState(1);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setInterval(() => {
      setN((v) => (v >= DEMO_SCRIPT.length + 1 ? 0 : v + 1));
    }, 2200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [n]);
  const visible = DEMO_SCRIPT.slice(0, Math.min(n, DEMO_SCRIPT.length));
  const typing = n <= DEMO_SCRIPT.length;
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-2xl">
      <div className="flex items-center gap-1.5 border-b border-zinc-100 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        <span className="ml-2 flex items-center gap-2 text-xs text-zinc-500">
          <span className="h-2 w-2 animate-ring rounded-full bg-green-500" /> live demo — your bot, our API
        </span>
      </div>
      <div ref={boxRef} className="h-64 space-y-3 overflow-y-auto bg-zinc-50 p-4">
        <AnimatePresence initial={false}>
          {visible.map((m, i) => (
            <motion.div
              key={`${i}-${m.text.slice(0, 8)}`}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, ease: EASE }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-5 ${m.role === "user" ? "bg-black text-white" : "border border-zinc-200 bg-white text-zinc-800"}`}>
                {m.text}
                {"meta" in m && m.meta && <div className="mt-1 font-mono text-[10px] opacity-60">{m.meta}</div>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {typing && visible.length > 0 && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5">
              {[0, 1, 2].map((d) => (
                <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-zinc-400" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const FAQS = [
  {
    q: "How does Repllyer answer customer questions?",
    a: "You describe your business and upload PDFs or Q&A into a private knowledge base. When a visitor chats, our AI answers from that knowledge — and anything it can't solve confidently is escalated to your human inbox with priority and topic attached.",
  },
  {
    q: "What happens when the AI can't solve something?",
    a: "It creates a ticket graded urgent / high / medium / low (money and quality issues first), saves the full transcript, and optionally asks the visitor for email and phone so you can follow up. Your team replies from the CRM and the visitor sees it instantly.",
  },
  {
    q: "What are action scripts?",
    a: "Reusable automations you build once in the Scripts playground — e.g. forgot-password reset emails with your own styled HTML. The AI verifies the visitor's info, then runs the script for a flat 30 credits. Secrets live inside each script, never shared.",
  },
  {
    q: "How do credits and pricing work?",
    a: "Every business starts with 180 free credits. 1 credit = 1 message, script runs cost 30 credits. Buy fixed packs or pay-as-you-go (down to ₹0.85/credit at volume), plus fixed-₹ coupons and gift cards. Extra businesses cost 100 credits.",
  },
  {
    q: "How do I integrate it with my bot?",
    a: "Two HTTPS calls to https://repllyer.vercel.app: POST /api/v1/session/init for a guest session, then POST /api/v1/chat per message with your x-api-key header. Full curl examples are in the docs — most teams integrate in under an hour.",
  },
  {
    q: "Do visitors need to give email up front?",
    a: "No. Sessions start as guests; the bot politely asks for email and phone mid-chat and saves them to your CRM automatically.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q}>
            <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
              <span className="text-sm font-medium">{f.q}</span>
              <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.25 }} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-zinc-200 text-sm">
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm leading-6 text-zinc-600">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

const HEADLINE_1 = "Customer care that";
const HEADLINE_2 = "resolves,";

export default function Home() {
  return (
    <div className="overflow-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0 grid-pattern opacity-70" />
        <div className="animate-floaty-slow absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-zinc-200/60 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-0 top-10 select-none overflow-hidden" aria-hidden="true">
          <div className="text-outline whitespace-nowrap text-center text-[18vw] font-bold leading-none tracking-tight opacity-40">REPLLYER</div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />
        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 md:pb-24 md:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 py-1 text-xs shadow-sm">
              <span className="h-2 w-2 animate-ring rounded-full bg-green-500" /> API-first • Human takeover • 180 msgs free
            </motion.div>
            <h1 className="text-[2.6rem] font-semibold leading-[1.02] tracking-tight md:text-6xl">
              {HEADLINE_1.split(" ").map((w, i) => (
                <motion.span key={w + i} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 + i * 0.07, ease: EASE }} className="inline-block">
                  {w}
                  {i < HEADLINE_1.split(" ").length - 1 ? " " : ""}
                </motion.span>
              ))}
              <br />
              <motion.span initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.32, ease: EASE }} className="inline-block">
                {HEADLINE_2}
              </motion.span>{" "}
              <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.55, delay: 0.45, ease: EASE }} className="inline-block bg-black px-3 text-white">
                not deflects.
              </motion.span>
            </h1>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.55, ease: EASE }} className="mx-auto mt-5 max-w-xl text-[15px] leading-6 text-zinc-600">
              Give us what you sell, we generate an API key. Your bot forwards customer queries — auto-resolved from your knowledge base, or escalated by priority &amp; topic. Scripts handle the rest.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.65, ease: EASE }} className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="btn-shine rounded-full bg-black px-7 py-3 text-sm font-medium text-white transition hover:bg-zinc-800">Start free — 180 msgs</Link>
              <Link href="/docs" className="rounded-full border border-zinc-300 bg-white px-7 py-3 text-sm font-medium transition hover:border-black">Read docs</Link>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.8 }} className="mx-auto mt-10 grid max-w-xl grid-cols-3 gap-4">
              {[
                { v: 180, suffix: "", label: "free messages" },
                { v: 8, suffix: "", label: "auto topics" },
                { v: 30, suffix: "cr", label: "per script run" },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-zinc-200 bg-white/80 px-2 py-3 backdrop-blur">
                  <div className="text-xl font-semibold md:text-2xl">
                    <CountUp to={s.v} suffix={s.suffix} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">{s.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.9, ease: EASE }} className="mx-auto mt-12 max-w-2xl">
            <LiveDemo />
          </motion.div>
        </div>
      </section>

      {/* MARQUEE */}
      <section aria-label="What Repllyer handles" className="border-y border-zinc-200 bg-black py-3.5 text-white">
        <Marquee duration={28}>
          {["Refunds", "Forgot password", "Order status", "Delivery failures", "Billing", "Bug reports", "Account help", "Feedback"].map((t) => (
            <span key={t} className="mx-6 flex items-center gap-6 text-xs font-medium tracking-[0.2em]">
              {t.toUpperCase()} <span className="text-zinc-500">✦</span>
            </span>
          ))}
        </Marquee>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16 md:py-24">
        <Reveal>
          <p className="font-mono text-xs tracking-[0.25em] text-zinc-400">HOW IT WORKS</p>
          <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight md:text-3xl">Live in three steps. No SDK hell.</h2>
        </Reveal>
        <Stagger className="mt-8 grid gap-5 md:grid-cols-3" gap={0.12}>
          {[
            { n: "01", t: "Tell us what you sell", d: "Paste a description, upload PDFs, or add Q&A. We build your private knowledge base securely." },
            { n: "02", t: "Drop in 1 API key", d: "Two HTTPS calls: init a guest session, then chat. We verify, meter credits, and track context." },
            { n: "03", t: "Auto, human, or script", d: "AI answers, escalates the rest by priority, and runs your action scripts when info checks out." },
          ].map((s) => (
            <Item key={s.n}>
              <div className="group h-full rounded-2xl border border-zinc-200 bg-white p-6 transition duration-300 hover:-translate-y-1.5 hover:border-black hover:shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs text-zinc-400">{s.n}</div>
                  <div className="h-8 w-8 rounded-full bg-zinc-100 transition group-hover:bg-black group-hover:text-white">→</div>
                </div>
                <div className="mt-4 text-[15px] font-semibold">{s.t}</div>
                <div className="mt-1.5 text-sm leading-6 text-zinc-600">{s.d}</div>
              </div>
            </Item>
          ))}
        </Stagger>

        {/* code demo */}
        <Reveal delay={0.1} className="mt-10">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 text-left shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-2.5">
              <span className="h-3 w-3 rounded-full bg-zinc-700" />
              <span className="h-3 w-3 rounded-full bg-zinc-700" />
              <span className="h-3 w-3 rounded-full bg-zinc-700" />
              <span className="ml-2 font-mono text-xs text-zinc-500">curl — session + chat</span>
              <span className="ml-auto"><CopyButton text={CURL_SNIPPET} dark /></span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-xs leading-5 text-zinc-300">{CURL_SNIPPET}</pre>
          </div>
        </Reveal>
      </section>

      {/* PRIORITY */}
      <section className="border-y border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <Reveal>
            <p className="font-mono text-xs tracking-[0.25em] text-zinc-400">PRIORITY ENGINE</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Priority that means something</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">Money &amp; quality issues surface first. No more FIFO ticket hell — every escalation lands pre-sorted with a topic.</p>
          </Reveal>
          <Stagger className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-4" gap={0.1}>
            {[
              { p: "urgent", c: "bg-black text-white", d: "payment / refund / billing / legal" },
              { p: "high", c: "bg-zinc-900 text-white", d: "product defect / bug / delivery failure" },
              { p: "medium", c: "bg-white border border-zinc-200", d: "account / how-to / order status" },
              { p: "low", c: "bg-white border border-zinc-200", d: "general / feedback / greeting" },
            ].map((x) => (
              <Item key={x.p}>
                <div className={`h-full rounded-xl px-4 py-5 transition duration-300 hover:-translate-y-1 hover:shadow-lg ${x.c}`}>
                  <div className="font-mono text-xs tracking-[0.2em]">{x.p.toUpperCase()}</div>
                  <div className="mt-2 text-xs opacity-80">{x.d}</div>
                </div>
              </Item>
            ))}
          </Stagger>
        </div>
      </section>

      {/* SCRIPTS */}
      <section id="scripts" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16 md:py-24">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <Reveal>
            <p className="font-mono text-xs tracking-[0.25em] text-zinc-400">ACTION SCRIPTS</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Automations that run themselves.</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Forgot-password emails, order lookups, status updates — write real JavaScript once in the Scripts playground. The AI collects and verifies visitor info, then runs it for a flat 30 credits.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-zinc-700">
              {["Sandboxed JS with params, contact & your own env vars", "Styled HTML emails via sendEmail()", "Every run logged with time, cost & outcome"].map((f) => (
                <li key={f} className="flex gap-2.5"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-black text-[10px] text-white">✓</span>{f}</li>
              ))}
            </ul>
            <Link href="/signup" className="btn-shine mt-6 inline-block rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800">Build your first script</Link>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 shadow-2xl">
              <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-2.5">
                <span className="h-3 w-3 rounded-full bg-zinc-700" />
                <span className="h-3 w-3 rounded-full bg-zinc-700" />
                <span className="h-3 w-3 rounded-full bg-zinc-700" />
                <span className="ml-2 font-mono text-xs text-zinc-500">forgot-password.js</span>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-black">30cr / run</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-xs leading-5 text-lime-300">{`if (!params.email) throw new Error("email required");

sendEmail(
  params.email,
  "Reset your password",
  "Hi " + contact.name + ", reset link inside."
);

result = { emailed: params.email };`}</pre>
            </div>
          </Reveal>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-t border-zinc-200 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <Reveal className="text-center">
            <p className="font-mono text-xs tracking-[0.25em] text-zinc-400">PRICING</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Start free, pay as you grow</h2>
          </Reveal>
          <Stagger className="mt-8 grid gap-5 md:grid-cols-4" gap={0.1}>
            {[
              { name: "Free", price: "₹0", sub: "180 msgs", cta: "Get started", href: "/signup", feat: ["1 API key", "Knowledge base", "Human queue"] },
              { name: "500", price: "₹499", sub: "one-time pack", cta: "Buy credits", href: "/dashboard", feat: ["500 credits", "No expiry (1y)", "Priority topics"] },
              { name: "2,500", price: "₹1,999", sub: "most popular", cta: "Buy credits", href: "/dashboard", feat: ["2,500 credits", "Email alerts", "Webhook"], popular: true },
              { name: "10,000", price: "₹6,999", sub: "scale", cta: "Buy credits", href: "/dashboard", feat: ["10k credits", "SLA + Analytics"] },
            ].map((p) => (
              <Item key={p.name}>
                <div className={`relative h-full rounded-2xl border p-6 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl ${p.popular ? "border-black bg-black text-white shadow-xl" : "border-zinc-200 bg-white"}`}>
                  {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-black px-3 py-0.5 text-[10px] font-semibold tracking-widest text-white ring-2 ring-white">POPULAR</span>}
                  <div className="font-mono text-xs tracking-widest opacity-60">{p.name}</div>
                  <div className={`mt-1 text-2xl font-semibold ${p.popular ? "text-white" : "text-black"}`}>{p.price}</div>
                  <div className={`text-xs ${p.popular ? "text-zinc-300" : "text-zinc-500"}`}>{p.sub}</div>
                  <ul className="mt-4 space-y-1.5 text-xs">
                    {p.feat.map((f) => <li key={f} className="flex gap-2"><span>—</span>{f}</li>)}
                  </ul>
                  <Link href={p.href} className={`mt-6 block rounded-full px-4 py-2 text-center text-xs font-medium transition ${p.popular ? "bg-white text-black hover:bg-zinc-200" : "bg-black text-white hover:bg-zinc-800"}`}>{p.cta}</Link>
                </div>
              </Item>
            ))}
          </Stagger>
          <Reveal delay={0.1}>
            <p className="mt-5 text-center text-xs text-zinc-500">Auto-credits on purchase. 1 credit = 1 message. Extra business = 100 credits. See docs for quickstart.</p>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-6 py-16 md:py-24">
        <Reveal className="text-center">
          <p className="font-mono text-xs tracking-[0.25em] text-zinc-400">FAQ</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Questions, answered</h2>
        </Reveal>
        <Reveal delay={0.08} className="mt-8">
          <Faq />
        </Reveal>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-black px-6 py-14 text-center text-white md:py-20">
            <div className="animate-floaty absolute -left-20 -top-20 h-64 w-64 rounded-full bg-zinc-800 blur-3xl" aria-hidden="true" />
            <div className="animate-floaty-slow absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-zinc-800 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <h2 className="mx-auto max-w-xl text-3xl font-semibold tracking-tight md:text-4xl">Stop losing customers to bad bots.</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">180 free messages. Live in under an hour. Your first automation running today.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/signup" className="btn-shine rounded-full bg-white px-7 py-3 text-sm font-medium text-black transition hover:bg-zinc-200">Get your API key</Link>
                <Link href="/docs" className="rounded-full border border-zinc-700 px-7 py-3 text-sm font-medium text-white transition hover:border-white">Read the docs</Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
