"use client";
import { useEffect, useState } from "react";
import { useBiz } from "@/components/dashboard/BizContext";
import { createBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";

type Ticket = { id: string; priority: string; topic: string; status: string; created_at: string; session_id: string; ai_confidence: number | null };

export default function Inbox() {
  const { selected } = useBiz();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!selected) return;
    const supa = createBrowserClient();
    const load = async () => {
      let q = supa.from("human_tickets").select("id, priority, topic, status, created_at, session_id, ai_confidence").eq("business_id", selected).order("created_at", { ascending: false }).limit(50);
      const { data } = await q;
      setTickets((data as Ticket[]) || []);
    };
    load();
    const ch = supa.channel(`tickets-${selected}`).on("postgres_changes", { event: "*", schema: "public", table: "human_tickets", filter: `business_id=eq.${selected}` }, load).subscribe();
    return () => { supa.removeChannel(ch); };
  }, [selected]);

  const filtered = tickets.filter((t) => filter === "all" || t.priority === filter || t.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Inbox — priority sorted</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-full border border-zinc-200 px-3 py-1 text-xs">
          <option value="all">All</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 text-left text-zinc-500"><tr><th className="px-4 py-2">Priority</th><th>Topic</th><th>Status</th><th>Session</th><th>AI conf</th><th>When</th></tr></thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-2"><span className={`rounded-full px-2 py-1 font-mono text-[11px] ${t.priority === "urgent" ? "bg-black text-white" : t.priority === "high" ? "bg-zinc-800 text-white" : "bg-zinc-100"}`}>{t.priority}</span></td>
                <td className="font-mono">{t.topic}</td>
                <td>{t.status}</td>
                <td><Link href={`/dashboard/chats/${t.session_id}`} className="font-mono text-[11px] underline">{t.session_id.slice(0, 8)}</Link></td>
                <td>{t.ai_confidence ?? "—"}</td>
                <td>{new Date(t.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-zinc-500">No tickets. Send a chat via API.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
