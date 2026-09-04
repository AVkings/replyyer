"use client";
import { useEffect, useState } from "react";
import { useBiz } from "@/components/dashboard/BizContext";

const PACKS = [
  { id: "pack_500", label: "500 credits — ₹499", credits: 500 },
  { id: "pack_2500", label: "2,500 credits — ₹1,999", credits: 2500 },
  { id: "pack_10000", label: "10,000 credits — ₹6,999", credits: 10000 },
];

declare global { interface Window { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } } }

export default function Billing() {
  const { selected } = useBiz();
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<{ delta: number; reason: string; balance_after: number; created_at: string }[]>([]);
  const [coupon, setCoupon] = useState("");
  const [gift, setGift] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!selected) return;
    const r = await fetch(`/api/credits?business_id=${selected}`);
    const j = await r.json();
    setBalance(j.balance);
    setLedger(j.ledger || []);
  };
  useEffect(() => { load(); }, [selected]);

  async function buy(pack_id: string) {
    if (!selected) return;
    setMsg("Creating order...");
    const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: selected, pack_id, coupon: coupon || undefined }) });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error || "checkout failed");

    // Load Razorpay script if needed
    if (!window.Razorpay) {
      await new Promise<void>((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = () => res();
        s.onerror = () => rej(new Error("razorpay load failed"));
        document.body.appendChild(s);
      });
    }
    const rzp = new window.Razorpay({
      key: j.key_id,
      order_id: j.order.id,
      amount: j.order.amount,
      currency: "INR",
      name: "Repllyer",
      description: j.applied_coupon ? `Coupon ${j.applied_coupon} applied` : PACKS.find((p) => p.id === pack_id)?.label,
      handler: () => { setMsg("Payment captured — credits will appear shortly (webhook)"); setTimeout(load, 3000); },
      notes: { business_id: selected },
      theme: { color: "#000000" },
    });
    rzp.open();
  }

  async function redeemGift(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/giftcards/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: selected, code: gift }) });
    const j = await r.json();
    setMsg(r.ok ? `Redeemed +${j.credits} credits` : j.error);
    if (r.ok) load();
  }

  async function validateCoupon() {
    const r = await fetch("/api/coupons/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: coupon }) });
    const j = await r.json();
    setMsg(r.ok ? `Coupon ${j.code}: ${j.percent}% off` : j.error);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Billing & Credits</h1>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold">Balance</div>
        <div className="mt-1 text-3xl font-semibold">{balance ?? "—"} <span className="text-sm font-normal text-zinc-500">credits</span></div>
        <div className="text-xs text-zinc-500">1 credit = 1 classified message. 180 free on signup.</div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold">Buy credits — Razorpay live</div>
        <div className="mt-3 flex gap-2">
          <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Coupon code (optional)" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <button onClick={validateCoupon} className="rounded-full border border-zinc-200 px-3 py-1 text-xs">Validate</button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {PACKS.map((p) => (
            <div key={p.id} className="rounded-2xl border border-zinc-200 p-4">
              <div className="text-sm font-semibold">{p.label}</div>
              <button onClick={() => buy(p.id)} className="mt-3 w-full rounded-full bg-black py-2 text-xs font-medium text-white">Pay with Razorpay</button>
            </div>
          ))}
        </div>
        {msg && <p className="mt-3 text-xs text-zinc-600">{msg}</p>}
      </div>

      <form onSubmit={redeemGift} className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold">Gift card</div>
        <div className="mt-2 flex gap-2">
          <input value={gift} onChange={(e) => setGift(e.target.value)} placeholder="GIFT-XXXX" className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <button className="rounded-full bg-black px-4 py-2 text-xs text-white">Redeem</button>
        </div>
      </form>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold">Ledger (last 20)</div>
        <div className="mt-3 space-y-1 text-xs">
          {ledger.map((l, i) => (
            <div key={i} className="flex justify-between border-t border-zinc-50 py-1.5">
              <span className={l.delta > 0 ? "text-green-600" : ""}>{l.delta > 0 ? "+" : ""}{l.delta} — {l.reason}</span>
              <span className="font-mono">{l.balance_after}</span>
              <span className="text-zinc-500">{new Date(l.created_at).toLocaleString()}</span>
            </div>
          ))}
          {ledger.length === 0 && <div className="text-zinc-500">No ledger yet.</div>}
        </div>
      </div>
    </div>
  );
}
