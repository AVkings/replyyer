"use client";
import { useEffect, useMemo, useState } from "react";
import { useBiz } from "@/components/dashboard/BizContext";
import { motion } from "framer-motion";
import { paygRateFor, paygAmountPaise, PAYG_MIN, PAYG_MAX, formatINR } from "@/lib/pricing";

const PACKS = [
  { id: "pack_500", label: "500 credits", sub: "₹499 • ₹0.998/cr", credits: 500 },
  { id: "pack_2500", label: "2,500 credits", sub: "₹1,999 • ₹0.80/cr", credits: 2500 },
  { id: "pack_10000", label: "10,000 credits", sub: "₹6,999 • ₹0.70/cr", credits: 10000 },
];

declare global { interface Window { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } } }

type RzpResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };

export default function Billing() {
  const { selected } = useBiz();
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<{ delta: number; reason: string; balance_after: number; created_at: string }[]>([]);
  const [coupon, setCoupon] = useState("");
  const [gift, setGift] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  // pay-as-you-go
  const [payg, setPayg] = useState(1000);

  const load = async () => {
    if (!selected) return;
    const r = await fetch(`/api/credits?business_id=${selected}`);
    const j = await r.json();
    setBalance(j.balance);
    setLedger(j.ledger || []);
  };
  useEffect(() => { load(); }, [selected]);

  const paygRate = paygRateFor(payg);
  const paygAmount = paygAmountPaise(payg);

  const couponUpper = useMemo(() => coupon.trim().toUpperCase(), [coupon]);

  async function ensureRzp() {
    if (!window.Razorpay) {
      await new Promise<void>((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = () => res();
        s.onerror = () => rej(new Error("load failed"));
        document.body.appendChild(s);
      });
    }
  }

  async function verifyPayment(resp: RzpResponse) {
    setMsg("Verifying payment…");
    const r = await fetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...resp, business_id: selected }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(j.error || "Verification failed — if money was captured, credits arrive via webhook shortly.");
      return;
    }
    setMsg(j.already ? `Already credited. Balance: ${j.balance}` : `Payment verified! +credits added. Balance: ${j.balance}`);
    load();
  }

  async function openCheckout(order: { id: string; amount: number }, key_id: string, desc: string) {
    await ensureRzp();
    const rzp = new window.Razorpay({
      key: key_id,
      order_id: order.id,
      amount: order.amount,
      currency: "INR",
      name: "Repllyer",
      description: desc,
      handler: (resp: unknown) => verifyPayment(resp as RzpResponse),
      modal: { ondismiss: () => setMsg("Checkout closed. If you paid, click Verify below or wait for webhook.") },
      theme: { color: "#000000" },
    });
    rzp.open();
  }

  async function buyPack(pack_id: string) {
    if (!selected || busy) return;
    setBusy(true);
    setMsg("Creating order...");
    try {
      const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: selected, pack_id, coupon: couponUpper || undefined }) });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error || "checkout failed"); return; }
      if (j.orders_persisted === false) {
        setMsg("Warning: order tracking unavailable (run 003 migration in Supabase) — payment will still verify via Razorpay directly. Continuing…");
      } else {
        setMsg(j.applied_coupon ? `Coupon ${String(j.applied_coupon).toUpperCase()} applied: −${formatINR(j.discount)}. Pay ${formatINR(j.amount)} for ${j.credits} credits.` : `Pay ${formatINR(j.amount)} for ${j.credits} credits.`);
      }
      await openCheckout(j.order, j.key_id, `${j.credits} credits${j.applied_coupon ? ` (coupon ${String(j.applied_coupon).toUpperCase()})` : ""}`);
    } finally {
      setBusy(false);
    }
  }

  async function buyPayg() {
    if (!selected || busy) return;
    if (payg < PAYG_MIN || payg > PAYG_MAX) { setMsg(`Enter ${PAYG_MIN}–${PAYG_MAX} credits.`); return; }
    setBusy(true);
    setMsg("Creating pay-as-you-go order...");
    try {
      const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: selected, pack_id: "payg", custom_credits: payg, coupon: couponUpper || undefined }) });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error || "checkout failed"); return; }
      if (j.orders_persisted === false) {
        setMsg("Warning: order tracking unavailable (run 003 migration in Supabase) — payment will still verify via Razorpay directly. Continuing…");
      } else {
        setMsg(`Pay ${formatINR(j.amount)} for ${j.credits} credits @ ₹${(j.amount / 100 / j.credits).toFixed(2)}/cr${j.applied_coupon ? ` (coupon ${String(j.applied_coupon).toUpperCase()})` : ""}.`);
      }
      await openCheckout(j.order, j.key_id, `${j.credits} credits pay-as-you-go`);
    } finally {
      setBusy(false);
    }
  }

  async function redeemGift(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/giftcards/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: selected, code: gift }) });
    const j = await r.json();
    setMsg(r.ok ? `Redeemed +${j.credits} credits` : j.error);
    if (r.ok) load();
  }

  async function validateCoupon() {
    if (!couponUpper) { setMsg("Enter a coupon code."); return; }
    const r = await fetch("/api/coupons/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: couponUpper }) });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error);
    const off = j.amount_off_paise != null ? `${formatINR(j.amount_off_paise)} off` : j.percent ? `${j.percent}% off` : "discount";
    setMsg(`Coupon ${String(j.code).toUpperCase()}: ${off}`);
  }

  return (
    <div className="space-y-6">
      <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-lg font-semibold">Billing & Credits</motion.h1>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold">Balance</div>
        <div className="mt-1 text-3xl font-semibold">{balance ?? "—"} <span className="text-sm font-normal text-zinc-500">credits</span></div>
        <div className="text-xs text-zinc-500">1 credit = 1 message • script run = 30 credits. 180 free on first business. Extra business = 100 credits.</div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold">Coupon</div>
        <div className="mt-1 text-xs text-zinc-500">Codes are UPPERCASE. Try <code>FLAT600</code> (₹600 off), <code>WELCOME500</code> (₹500 off).</div>
        <div className="mt-3 flex gap-2">
          <input
            value={coupon}
            onChange={(e) => setCoupon(e.target.value.toUpperCase().replace(/[^A-Z0-9-_]/g, ""))}
            placeholder="COUPON CODE"
            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-mono uppercase tracking-wider"
            style={{ textTransform: "uppercase" }}
          />
          <motion.button whileTap={{ scale: 0.97 }} onClick={validateCoupon} className="rounded-full border border-zinc-200 px-3 py-1 text-xs">Validate</motion.button>
        </div>
        {couponUpper && <div className="mt-2 text-xs">Applying as: <span className="font-mono font-bold">{couponUpper}</span></div>}

        <div className="mt-5 text-sm font-semibold">Fixed packs</div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {PACKS.map((p) => (
            <motion.div key={p.id} whileHover={{ y: -2 }} className="rounded-2xl border border-zinc-200 p-4">
              <div className="text-sm font-semibold">{p.label}</div>
              <div className="text-xs text-zinc-500">{p.sub}</div>
              <motion.button whileTap={{ scale: 0.98 }} onClick={() => buyPack(p.id)} disabled={busy} className="mt-3 w-full rounded-full bg-black py-2 text-xs font-medium text-white disabled:opacity-50">Secure checkout</motion.button>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl bg-zinc-950 p-4 text-white">
          <div className="text-sm font-semibold">Pay as you go — volume pricing</div>
          <div className="mt-1 text-xs text-zinc-400">500+ @ ₹0.95/cr • 1500+ @ ₹0.90/cr • 2500+ @ ₹0.85/cr • below 500 @ ₹1.00/cr</div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="range" min={PAYG_MIN} max={PAYG_MAX} step={50} value={payg}
              onChange={(e) => setPayg(parseInt(e.target.value, 10))}
              className="flex-1"
            />
            <input
              type="number" min={PAYG_MIN} max={PAYG_MAX} value={payg}
              onChange={(e) => setPayg(Math.max(PAYG_MIN, Math.min(PAYG_MAX, parseInt(e.target.value || "0", 10) || PAYG_MIN)))}
              className="w-32 rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span><span className="text-2xl font-semibold">{payg.toLocaleString("en-IN")}</span> credits @ ₹{paygRate.toFixed(2)}/cr</span>
            <span className="text-lg font-semibold">= {formatINR(paygAmount)}</span>
          </div>
          <motion.button whileTap={{ scale: 0.98 }} onClick={buyPayg} disabled={busy} className="mt-4 w-full rounded-full bg-white py-2.5 text-xs font-bold text-black disabled:opacity-50">
            {busy ? "Creating order…" : `Buy ${payg.toLocaleString("en-IN")} credits for ${formatINR(paygAmount)}`}
          </motion.button>
        </div>
        {msg && <p className="mt-3 text-xs text-zinc-600">{msg}</p>}
      </motion.div>

      <motion.form initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} onSubmit={redeemGift} className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold">Gift card</div>
        <div className="mt-2 flex gap-2">
          <input value={gift} onChange={(e) => setGift(e.target.value.toUpperCase())} placeholder="GIFT-XXXX" className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 font-mono text-sm uppercase" style={{ textTransform: "uppercase" }} />
          <motion.button whileTap={{ scale: 0.97 }} className="rounded-full bg-black px-4 py-2 text-xs text-white">Redeem</motion.button>
        </div>
      </motion.form>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="rounded-2xl border border-zinc-200 bg-white p-5">
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
      </motion.div>
    </div>
  );
}
