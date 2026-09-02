"use client";
import { useState } from "react";

export default function PricingClient() {
  const [loading, setLoading] = useState<string | null>(null);

  const buy = async (plan: string) => {
    setLoading(plan);
    try {
      // For demo, organizationId from first org or prompt
      const orgId = prompt("Enter organizationId (or leave empty for demo):") || undefined;
      const res = await fetch("/api/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, organizationId: orgId }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Order failed");
      // Load Razorpay checkout
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      document.body.appendChild(script);
      script.onload = () => {
        const options = {
          key: j.keyId,
          amount: j.amount,
          currency: j.currency,
          name: "Repllyer",
          description: `Plan ${plan} — ${j.limit} conversations`,
          order_id: j.orderId,
          handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
            // Verify on server and activate plan
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...response, plan, organizationId: orgId }),
            });
            const verifyJson = await verifyRes.json();
            if (verifyJson.success) {
              alert(`Payment verified! Plan ${plan} activated — ${verifyJson.limit} conversations. Refresh billing.`);
              window.location.reload();
            } else {
              alert("Payment succeeded but verification failed: " + (verifyJson.error || "unknown"));
            }
          },
          theme: { color: "#ffffff" },
          modal: { ondismiss: function() { setLoading(null); } },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rzp = new (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }).Razorpay(options);
        rzp.open();
      };
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-[20px] border border-neutral-800 bg-black p-4">
      <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">Buy via Razorpay — Secure checkout</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {["basic_300", "basic_600", "payg"].map((p) => (
          <button key={p} onClick={() => buy(p)} disabled={!!loading} className="rounded-xl bg-white py-2.5 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50">
            {loading === p ? "Creating order..." : `Buy ${p}`}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-600">Secure payment via Razorpay. No keys exposed — server handles secrets.</p>
    </div>
  );
}
