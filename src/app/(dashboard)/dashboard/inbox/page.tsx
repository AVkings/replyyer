"use client";
import { useEffect, useMemo, useState } from "react";
import { useBiz } from "@/components/dashboard/BizContext";
import { createBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { motion } from "framer-motion";
import { RepllyerLoader } from "@/components/Loader";
import { sortByPriority, priorityStyle } from "@/lib/priority";

type SessionRow = {
  id: string;
  created_at: string;
  status: string;
  end_user_id: string;
  end_users: { name: string; email: string } | null;
};
type TicketRow = {
  id: string;
  session_id: string;
  priority: string;
  topic: string;
  status: string;
  created_at: string;
};
type MsgRow = { session_id: string; content: string; role: string; created_at: string };

type ChatRow = {
  session_id: string;
  visitor: string;
  email: string;
  priority: string | null;
  topic: string | null;
  ticket_status: string | null;
  last_message: string;
  last_at: string;
  created_at: string;
  needs_human: boolean;
};

export default function Inbox() {
  const { selected } = useBiz();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [msgs, setMsgs] = useState<MsgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const load = async () => {
    if (!selected) return;
    setLoading(true);
    const supa = createBrowserClient();
    const [s, t, m] = await Promise.all([
      supa.from("sessions").select("id, created_at, status, end_user_id, end_users(name,email)").eq("business_id", selected).order("created_at", { ascending: false }).limit(100),
      supa.from("human_tickets").select("id, session_id, priority, topic, status, created_at").eq("business_id", selected).order("created_at", { ascending: false }).limit(100),
      supa.from("messages").select("session_id, content, role, created_at").eq("business_id", selected).order("created_at", { ascending: false }).limit(300),
    ]);
    setSessions((s.data as unknown as SessionRow[]) || []);
    setTickets((t.data as TicketRow[]) || []);
    setMsgs((m.data as MsgRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!selected) return;
    const supa = createBrowserClient();
    const ch = supa
      .channel(`inbox-${selected}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "human_tickets", filter: `business_id=eq.${selected}` }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `business_id=eq.${selected}` }, load)
      .subscribe();
    return () => {
      supa.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const chats: ChatRow[] = useMemo(() => {
    const ticketBySession = new Map<string, TicketRow[]>();
    tickets.forEach((t) => {
      const arr = ticketBySession.get(t.session_id) || [];
      arr.push(t);
      ticketBySession.set(t.session_id, arr);
    });
    const lastBySession = new Map<string, MsgRow>();
    msgs.forEach((m) => {
      if (!lastBySession.has(m.session_id)) lastBySession.set(m.session_id, m);
    });
    const rows: ChatRow[] = sessions.map((s) => {
      const ts = ticketBySession.get(s.id) || [];
      // highest priority ticket (urgent first)
      const sorted = [...ts].sort((a, b) => {
        const w: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (w[a.priority] ?? 4) - (w[b.priority] ?? 4);
      });
      const top = sorted[0];
      const last = lastBySession.get(s.id);
      return {
        session_id: s.id,
        visitor: s.end_users?.name || "Guest",
        email: s.end_users?.email?.includes("@repllyer.local") ? "guest" : s.end_users?.email || "—",
        priority: top?.priority || null,
        topic: top?.topic || null,
        ticket_status: top?.status || null,
        last_message: last?.content?.slice(0, 120) || "No messages yet",
        last_at: last?.created_at || s.created_at,
        created_at: s.created_at,
        needs_human: ts.some((x) => x.status === "open" || x.status === "assigned"),
      };
    });
    return rows.sort(sortByPriority as (a: ChatRow, b: ChatRow) => number);
  }, [sessions, tickets, msgs]);

  const filtered = chats.filter((c) => {
    if (filter === "all") return true;
    if (filter === "needs-human") return c.needs_human;
    if (["urgent", "high", "medium", "low"].includes(filter)) return c.priority === filter;
    if (["open", "assigned", "resolved"].includes(filter)) return c.ticket_status === filter;
    return true;
  }).filter((c) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return c.visitor.toLowerCase().includes(s) || c.email.toLowerCase().includes(s) || c.last_message.toLowerCase().includes(s) || (c.topic || "").includes(s);
  });

  if (!selected) return <div className="text-sm text-zinc-500">Select a business in Settings.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <h1 className="text-lg font-semibold">Inbox — chats, sorted by priority</h1>
          <p className="text-xs text-zinc-500">{chats.length} chats • urgent first • click to open messages</p>
        </div>
        <button onClick={load} className="rounded-full border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50">Refresh</button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search visitor, email, message…" className="flex-1 min-w-[200px] rounded-full border border-zinc-200 px-4 py-2 text-xs outline-none focus:border-black" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-full border border-zinc-200 px-3 py-2 text-xs">
          <option value="all">All</option>
          <option value="needs-human">Needs human</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {loading ? (
        <RepllyerLoader label="Loading chats…" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-12 text-center text-xs text-zinc-500">No chats. Send a chat via API or docs.</div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((c, i) => (
            <motion.div key={c.session_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
              <Link href={`/dashboard/chats/${c.session_id}`} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 hover:border-black transition">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black text-xs font-bold text-white">
                  {(c.visitor || "G").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium truncate">{c.visitor}</span>
                    {c.priority ? (
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${priorityStyle(c.priority)}`}>{c.priority}</span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">no priority</span>
                    )}
                    {c.topic && <span className="rounded-full bg-zinc-50 border border-zinc-200 px-2 py-0.5 font-mono text-[11px]">{c.topic}</span>}
                    {c.needs_human && <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] text-red-700">needs human</span>}
                  </div>
                  <div className="mt-1 truncate text-xs text-zinc-600">{c.last_message}</div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">{c.email} • {new Date(c.last_at).toLocaleString()}</div>
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
