"use client";
import { motion } from "framer-motion";

export function RepllyerLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-6 justify-center">
      <div className="relative h-8 w-8">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-zinc-200"
        />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-black"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
        />
        <div className="absolute inset-0 grid place-items-center text-[11px] font-bold">R</div>
      </div>
      <div className="text-xs text-zinc-500">
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
        >
          {label}
        </motion.span>
      </div>
    </div>
  );
}

export function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-zinc-400"
          animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}
