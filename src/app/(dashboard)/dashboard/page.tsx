"use client";
import { useEffect, useState } from "react";
import { useBiz } from "@/components/dashboard/BizContext";
import { createBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Overview() {
  const { selected, bizs } = useBiz();
  const biz = bizs.find((b) => b.id === selected);
  const [balance, setBalance] = useState<number | null>(null);
  const [stats, setStats] = useState({ tickets: 0, sessions: 0, resolved: 0 });
  const [recent, setRecent] = useState<{ id: string; priority: string; topic: string; created_at: string }[]>([]);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/credits?business_id=${selected}`).then((r) => r.json()).then((j) => setBalance(j.balance ?? 0));
    const supa = createBrowserClient();
    Promise.all([
      supa.from("human_tickets").select("id", { count: "exact", head: true }).eq("business_id", selected).then((r) => r.count || 0),
      supa.from("sessions").select("id", { count: "exact", head: true }).eq("business_id", selected).then((r) => r.count || 0),
      supa.from("human_tickets").select("id, priority, topic, created_at").eq("business_id", selected).order("created_at", { ascending: false }).limit(5).then((r) => r.data || []),
    ]).then(([tickets, sessions, rec]) => {
      setStats({ tickets, sessions, resolved: 0 });
      setRecent(rec as typeof recent);
    });
  }, [selected]);

  if (!selected) return <div className="text-sm text-zinc-500">Create a business in Settings to get started.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Overview — {biz?.name}</h1>
        <p className="text-xs text-zinc-500">{biz?.domain || "No domain"} • {balance !== null ? `${balance} credits left` : "loading credits..."}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-xs text-zinc-500">Credits</div>
          <div className="mt-1 text-2xl font-semibold">{balance ?? "—"}</div>
          <div className="text-xs text-zinc-500">180 free to start. <Link href="/dashboard/billing" className="underline">Buy more</Link></div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-xs text-zinc-500">Sessions (chats)</div>
          <div className="mt-1 text-2xl font-semibold">{stats.sessions}</div>
          <div className="text-xs text-zinc-500">Each session = one visitor (name/email captured)</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl bg-black p-5 text-white">
          <div className="text-xs text-zinc-400">Human tickets</div>
          <div className="mt-1 text-2xl font-semibold">{stats.tickets}</div>
          <Link href="/dashboard/inbox" className="text-xs underline">Open inbox →</Link>
        </motion.div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Recent escalations</div>
          <Link href="/dashboard/chats" className="text-xs underline">View CRM →</Link>
        </div>
        <div className="mt-3 space-y-2">
          {recent.length === 0 && <div className="text-xs text-zinc-500">No tickets yet — hit your API.</div>}
          {recent.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-zinc-100 px-3 py-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${r.priority === "urgent" ? "bg-black text-white" : r.priority === "high" ? "bg-zinc-800 text-white" : "bg-zinc-100"}`}>{r.priority}</span>
              <span className="font-mono">{r.topic}</span>
              <span className="text-zinc-500">{new Date(r.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-950 p-5 text-white">
        <div className="text-sm font-semibold">Quick test</div>
        <p className="mt-1 text-xs text-zinc-400">Use the playground in CRM to test session + chat without curl.</p>
        <Link href="/dashboard/chats" className="mt-3 inline-block rounded-full bg-white px-4 py-1.5 text-xs font-medium text-black">Open CRM</Link>
      </div>
    </div>
  );
}
