"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";
import { motion } from "framer-motion";
import { RepllyerLoader, TypingDots } from "@/components/Loader";
import { priorityStyle } from "@/lib/priority";
import Link from "next/link";

type Msg = { id: string; role: string; content: string; created_at: string };
type Ticket = { id: string; priority: string; topic: string; status: string; ai_confidence: number | null; created_at: string };

export default function ChatDetail() {
  const { id } = useParams<{ id: string }>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [meta, setMeta] = useState<{ name: string; email: string } | null>(null);
  const [businessId, setBusinessId] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const supa = createBrowserClient();
    const [{ data: sess }, { data: m }, { data: t }] = await Promise.all([
      supa.from("sessions").select("id, business_id, end_users(name,email)").eq("id", id).single(),
      supa.from("messages").select("id, role, content, created_at").eq("session_id", id).order("created_at", { ascending: true }),
      supa.from("human_tickets").select("id, priority, topic, status, ai_confidence, created_at").eq("session_id", id).order("created_at", { ascending: false }),
    ]);
    const s = sess as unknown as { business_id: string; end_users: { name: string; email: string } } | null;
    if (s) {
      setBusinessId(s.business_id);
      setMeta(s.end_users || null);
    }
    setMsgs((m as Msg[]) || []);
    setTickets((t as Ticket[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const supa = createBrowserClient();
    const ch = supa
      .channel(`chat-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `session_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "human_tickets", filter: `session_id=eq.${id}` }, load)
      .subscribe();
    return () => {
      supa.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const topTicket = tickets[0];
  const openTicket = tickets.find((x) => x.status === "open" || x.status === "assigned");

  async function sendHuman() {
    if (!reply.trim() || !businessId) return;
    setSending(true);
    // Use server API so takeover also flips ticket to assigned + is delivered to polling clients
    const r = await fetch(`/api/tickets/${openTicket?.id || topTicket?.id || "direct"}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: id, business_id: businessId, content: reply.trim() }),
    });
    if (!r.ok) {
      // fallback: direct insert
      const supa = createBrowserClient();
      await supa.from("messages").insert({ session_id: id, business_id: businessId, role: "human", content: reply.trim() });
    }
    setReply("");
    setSending(false);
    load();
  }

  async function setTicketStatus(status: "open" | "assigned" | "resolved") {
    const t = openTicket || topTicket;
    if (!t) return;
    await fetch(`/api/tickets/${t.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  if (loading) return <RepllyerLoader label="Opening chat…" />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/dashboard/inbox" className="text-xs text-zinc-500 hover:text-black">← Back to Inbox</Link>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-black text-xs font-bold text-white">
            {(meta?.name || "G").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold">{meta?.name || "Guest"}</div>
            <div className="text-xs text-zinc-500 font-mono">{meta?.email || "—"} • {String(id).slice(0, 8)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {topTicket ? (
            <>
              <span className={`rounded-full px-2 py-1 text-[11px] font-mono ${priorityStyle(topTicket.priority)}`}>{topTicket.priority}</span>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 font-mono text-[11px]">{topTicket.topic}</span>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px]">{topTicket.status}</span>
            </>
          ) : (
            <span className="rounded-full bg-green-50 border border-green-200 px-2 py-1 text-[11px] text-green-700">AI handled</span>
          )}
        </div>
      </div>

      {openTicket && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex flex-wrap items-center gap-2 justify-between text-xs">
          <span>Escalated — human takeover active. Your reply is delivered to the visitor instantly.</span>
          <div className="flex gap-2">
            <button onClick={() => setTicketStatus("assigned")} className="rounded-full bg-black px-3 py-1 text-white">Take over</button>
            <button onClick={() => setTicketStatus("resolved")} className="rounded-full border border-zinc-300 bg-white px-3 py-1">Resolve</button>
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 min-h-[300px]">
        {msgs.length === 0 && <div className="text-xs text-zinc-500 text-center py-10">No messages yet.</div>}
        {msgs.map((m) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${m.role === "user" ? "bg-black text-white rounded-br-md" : m.role === "human" ? "bg-white border-2 border-black text-black rounded-bl-md" : "bg-white border border-zinc-200 text-black rounded-bl-md"}`}>
              <div className="text-[11px] opacity-60 font-mono">{m.role === "human" ? "you (human)" : m.role} • {new Date(m.created_at).toLocaleTimeString()}</div>
              <div className="mt-1 whitespace-pre-wrap">{m.content}</div>
            </div>
          </motion.div>
        ))}
        {sending && <div className="text-xs text-zinc-500"><TypingDots /> sending…</div>}
        <div ref={bottomRef} />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3">
        <div className="flex gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendHuman()}
            placeholder="Reply as human — delivered instantly to visitor…"
            className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm outline-none focus:border-black"
          />
          <motion.button whileTap={{ scale: 0.97 }} onClick={sendHuman} disabled={sending || !reply.trim()} className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {sending ? "Sending…" : "Send"}
          </motion.button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">Human messages are stored with role=human and visible to the end-user via polling <code className="font-mono">GET /api/v1/session/messages?session_id=…</code></p>
      </div>
    </div>
  );
}
