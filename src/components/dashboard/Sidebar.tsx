"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Ticket, Settings, LogOut, Sparkles, MessageCircle, Database, Palette, CreditCard, BookOpen } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/tickets", label: "Tickets", icon: Ticket },
  { href: "/dashboard/chatbox", label: "Chat Box", icon: Palette },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const SECONDARY = [
  { href: "/chat-demo", label: "Chat Demo", icon: MessageCircle },
  { href: "/ingest", label: "Ingest", icon: Database },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
  { href: "/docs", label: "Docs", icon: BookOpen },
];

export default function Sidebar({ email }: { email?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-neutral-800 bg-black">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-neutral-800 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-white">Repllyer</p>
          <p className="text-xs text-neutral-500">B&W Premium</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-medium uppercase tracking-widest text-neutral-600">CRM</p>
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                  active ? "bg-white text-black" : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {active && <motion.span layoutId="active-dot" className="ml-auto h-2 w-2 rounded-full bg-black" />}
              </Link>
            );
          })}
        </div>

        <div className="space-y-1">
          <p className="px-3 text-[11px] font-medium uppercase tracking-widest text-neutral-600">Tools</p>
          {SECONDARY.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm text-neutral-500 hover:bg-neutral-900 hover:text-white"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {/* User + logout */}
      <div className="border-t border-neutral-800 p-4">
        {email && <p className="truncate px-1 text-xs text-neutral-500">{email}</p>}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="mt-3 flex w-full items-center gap-2 rounded-2xl border border-neutral-800 bg-black px-3 py-2.5 text-sm font-medium text-white hover:bg-neutral-900 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Signing out…" : "Logout"}
        </button>
      </div>
    </aside>
  );
}
