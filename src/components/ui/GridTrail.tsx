"use client";
import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function GridTrail({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: -1000, y: -1000 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    const handleLeave = () => setMouse({ x: -1000, y: -1000 });
    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  const cols = 20;
  const rows = 12;

  return (
    <div ref={ref} className={`absolute inset-0 overflow-hidden pointer-events-auto ${className}`}>
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
        {Array.from({ length: cols * rows }).map((_, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          // Calculate distance to mouse
          const cellW = 100 / cols;
          const cellH = 100 / rows;
          // Approximate cell center in % (we use mouse in px, but convert)
          // Instead use simple proximity: if mouse near, glow
          // We use distance in grid units
          const rect = ref.current?.getBoundingClientRect();
          const pxCellW = rect ? rect.width / cols : 50;
          const pxCellH = rect ? rect.height / rows : 50;
          const cx = col * pxCellW + pxCellW / 2;
          const cy = row * pxCellH + pxCellH / 2;
          const dx = mouse.x - cx;
          const dy = mouse.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 120;
          const intensity = Math.max(0, 1 - dist / maxDist);
          const scale = 1 + intensity * 0.15;
          const opacity = intensity * 0.6;

          return (
            <motion.div
              key={i}
              className="border border-white/[0.04] relative"
              style={{
                background: `rgba(255,255,255,${opacity * 0.08})`,
                scale,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              {intensity > 0.5 && <div className="absolute inset-0 bg-white/[0.06] blur-[1px]" />}
            </motion.div>
          );
        })}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black pointer-events-none" />
    </div>
  );
}
