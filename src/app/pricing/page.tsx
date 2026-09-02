import Link from "next/link";
import { Sparkles, Check, Zap } from "lucide-react";
import PricingClient from "@/components/pricing/PricingClient";

export const metadata = { title: "Pricing — Repllyer" };

const plans = [
  { id: "free", name: "Free", price: "$0", limit: "180 conversations / month", features: ["180 convos", "RAG + GoFile", "Community support"], cta: "Start free" },
  { id: "basic_300", name: "Basic", price: "$3", limit: "300 conversations", features: ["300 convos", "Priority support", "Custom chatbox"], cta: "Buy Basic" },
  { id: "basic_600", name: "Pro", price: "$5", limit: "600 conversations", features: ["600 convos", "Priority + Email capture", "Excel export"], cta: "Buy Pro" },
  { id: "payg", name: "Pay as you go", price: "PayG", limit: "Unlimited", features: ["Pay per convo", "No monthly cap", "Razorpay"], cta: "Pay as you go" },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black"><Sparkles className="h-4 w-4" /></div>
            <span className="text-sm font-semibold">Repllyer</span>
          </Link>
          <Link href="/dashboard/billing" className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black">Dashboard Billing</Link>
        </div>
      </header>
      <main className="relative mx-auto max-w-6xl px-6 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1 text-xs text-neutral-500"><Zap className="h-3 w-3" /> Transparent pricing</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Conversation-based pricing</h1>
          <p className="mt-3 text-sm text-neutral-500">Free 180, Basic 300 $3, Pro 600 $5, Pay as you go unlimited. Secure Razorpay checkout.</p>
        </div>
        <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <div key={p.id} className="rounded-[20px] border border-neutral-800 bg-neutral-950 p-6 flex flex-col">
              <h3 className="text-sm font-semibold">{p.name}</h3>
              <p className="mt-1 text-2xl font-bold">{p.price}</p>
              <p className="text-xs text-neutral-500">{p.limit}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-neutral-400"><Check className="h-3 w-3 text-white" />{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-8 max-w-5xl">
          <PricingClient />
        </div>
      </main>
    </div>
  );
}
