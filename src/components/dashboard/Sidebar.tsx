"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const nav = [
  { href: "/dashboard", label: "Overview", icon: "◧" },
  { href: "/dashboard/inbox", label: "Inbox", icon: "✉" },
  { href: "/dashboard/chats", label: "CRM • Chats", icon: "◈" },
  { href: "/dashboard/knowledge", label: "Knowledge", icon: "≡" },
  { href: "/dashboard/scripts", label: "Scripts • 30cr", icon: "⚡" },
  { href: "/dashboard/billing", label: "Billing & Credits", icon: "₹" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-[220px] shrink-0 border-r border-zinc-200 bg-white">
      <div className="sticky top-[57px] p-4">
        <div className="space-y-1">
          {nav.map((n) => {
            const active = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href} className={`relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${active ? "text-white" : "hover:bg-zinc-50 text-zinc-700"}`}>
                {active && <motion.span layoutId="sidebar-active" className="absolute inset-0 rounded-xl bg-black" transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} />}
                <span className="relative w-5 text-center text-xs">{n.icon}</span>
                <span className="relative">{n.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="text-xs font-semibold">Need help?</div>
          <div className="mt-1 text-xs text-zinc-600">Docs, curl examples, and session flow.</div>
          <Link href="/docs" className="mt-2 inline-block rounded-full bg-black px-3 py-1 text-xs text-white">Open docs</Link>
        </div>
      </div>
    </aside>
  );
}
