"use client";
import { useEffect, useMemo, useState } from "react";
import { useBiz } from "@/components/dashboard/BizContext";
import { createBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { motion } from "framer-motion";
import { RepllyerLoader } from "@/components/Loader";
import { sortByPriority, priorityStyle } from "@/lib/priority";

type SessionRow = { id: string; created_at: string; status: string; end_user_id: string; end_users: { name: string; email: string } | null };
type TicketRow = { session_id: string; priority: string; topic: string; status: string };
type MsgRow = { session_id: string; content: string; created_at: string };

export default function Chats() {
  const { selected } = useBiz();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [msgs, setMsgs] = useState<MsgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    if (!selected) return;
    setLoading(true);
    const supa = createBrowserClient();
    const [s, t, m] = await Promise.all([
      supa.from("sessions").select("id, created_at, status, end_user_id, end_users(name,email)").eq("business_id", selected).order("created_at", { ascending: false }).limit(100),
      supa.from("human_tickets").select("session_id, priority, topic, status").eq("business_id", selected).limit(100),
      supa.from("messages").select("session_id, content, created_at").eq("business_id", selected).order("created_at", { ascending: false }).limit(300),
    ]);
    setSessions((s.data as unknown as SessionRow[]) || []);
    setTickets((t.data as TicketRow[]) || []);
    setMsgs((m.data as MsgRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const rows = useMemo(() => {
    const priBySession = new Map<string, TicketRow>();
    const w: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    tickets.forEach((t) => {
      const cur = priBySession.get(t.session_id);
      if (!cur || (w[t.priority] ?? 4) < (w[cur.priority] ?? 4)) priBySession.set(t.session_id, t);
    });
    const lastBy = new Map<string, MsgRow>();
    msgs.forEach((m) => {
      if (!lastBy.has(m.session_id)) lastBy.set(m.session_id, m);
    });
    return sessions
      .map((s) => ({
        ...s,
        priority: priBySession.get(s.id)?.priority || null,
        topic: priBySession.get(s.id)?.topic || null,
        last: lastBy.get(s.id)?.content?.slice(0, 110) || "No messages yet",
        last_at: lastBy.get(s.id)?.created_at || s.created_at,
      }))
      .sort((a, b) => sortByPriority({ priority: a.priority, created_at: a.last_at }, { priority: b.priority, created_at: b.last_at }))
      .filter((s) => {
        if (!q.trim()) return true;
        const v = q.toLowerCase();
        return (s.end_users?.name || "").toLowerCase().includes(v) || (s.end_users?.email || "").toLowerCase().includes(v) || s.last.toLowerCase().includes(v);
      });
  }, [sessions, tickets, msgs, q]);

  if (!selected) return <div className="text-sm text-zinc-500">Select a business in Settings.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">CRM — all chats</h1>
          <p className="text-xs text-zinc-500">{rows.length} conversations • priority first • click to open thread</p>
        </div>
        <button onClick={load} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs hover:border-black">Refresh</button>
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search visitor, email, message…" className="w-full rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-xs outline-none focus:border-black" />

      {loading ? (
        <RepllyerLoader label="Loading conversations…" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-12 text-center text-xs text-zinc-500">No chats yet. Point your bot at the API.</div>
      ) : (
        <div className="grid gap-2">
          {rows.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.25) }}>
              <Link href={`/dashboard/chats/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 hover:border-black hover:shadow-sm transition">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black text-xs font-bold text-white">
                  {(s.end_users?.name || "G").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium truncate">{s.end_users?.name || "Guest"}</span>
                    {s.priority ? (
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${priorityStyle(s.priority)}`}>{s.priority}</span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">AI handled</span>
                    )}
                    {s.topic && <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px]">{s.topic}</span>}
                    <span className="rounded-full bg-zinc-50 border border-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">{s.status}</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-zinc-600">{s.last}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-zinc-400">{s.end_users?.email || "—"} • {new Date(s.last_at).toLocaleString()}</div>
                </div>
                <span className="text-zinc-400">→</span>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
