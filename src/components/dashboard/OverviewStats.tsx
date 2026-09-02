"use client";

import { motion } from "framer-motion";
import { Ticket, CheckCircle2, MessageCircleMore } from "lucide-react";
import { useEffect, useState } from "react";

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span>
      {display}
      {suffix}
    </span>
  );
}

export default function OverviewStats({
  total,
  autoPct,
  autoResolved,
  active,
}: {
  total: number;
  autoPct: number;
  autoResolved: number;
  active: number;
}) {
  const cards = [
    { label: "Total Tickets", value: total, suffix: "", icon: Ticket, sub: "All time" },
    { label: "Auto-Resolved", value: autoPct, suffix: "%", icon: CheckCircle2, sub: `${autoResolved} resolved by AI` },
    { label: "Active Conversations", value: active, suffix: "", icon: MessageCircleMore, sub: "Live now" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 400, damping: 30 }}
          whileHover={{ scale: 1.02 }}
          className="rounded-[24px] border border-neutral-800 bg-neutral-950 p-6"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">{c.label}</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black">
              <c.icon className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-white">
            <AnimatedNumber value={c.value} suffix={c.suffix} />
          </p>
          <p className="mt-1 text-xs text-neutral-500">{c.sub}</p>
        </motion.div>
      ))}
    </div>
  );
}
