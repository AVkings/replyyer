"use client";

import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, UserCheck, X, ExternalLink, Clock, AlertCircle, CheckCircle2, Send, Loader2 } from "lucide-react";

type Ticket = {
  id: string;
  title: string;
  ai_summary: string | null;
  priority_level: number;
  status: string;
  created_at: string;
  conversation_id: string;
  organization_id: string;
};

type ChatMessage = { role: string; content: string; attachment_url: string | null; timestamp: string };

function formatDate(iso: string) {
  // Deterministic UTC format to avoid hydration mismatch (server vs client locale)
  try {
    const d = new Date(iso);
    // Use UTC to be consistent across server/client timezones
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }) + " UTC";
  } catch {
    return iso.slice(0, 19).replace("T", " ");
  }
}

function priorityLabel(p: number) {
  if (p >= 5) return { text: "P5 · Critical", cls: "bg-red-600 text-white border-red-600" };
  if (p === 4) return { text: "P4 · High", cls: "bg-orange-500 text-white border-orange-500" };
  if (p === 3) return { text: "P3 · Medium", cls: "bg-yellow-500 text-black border-yellow-500" };
  if (p === 2) return { text: "P2 · Low", cls: "bg-blue-600 text-white border-blue-600" };
  return { text: "P1 · Minimal", cls: "bg-neutral-700 text-white border-neutral-700" };
}

function statusBadge(s: string) {
  if (s === "auto_resolved") return { label: "auto_resolved", cls: "border border-neutral-700 bg-neutral-950 text-neutral-300" };
  if (s === "escalated") return { label: "escalated", cls: "bg-white text-black" };
  return { label: s, cls: "border border-neutral-800 bg-black text-neutral-400" };
}

export default function TicketsClient({ tickets: initial }: { tickets: Ticket[] }) {
  const [tickets, setTickets] = useState(initial);
  const [filter, setFilter] = useState<"all" | "auto_resolved" | "pending_human" | "escalated">("all");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [chat, setChat] = useState<ChatMessage[] | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [takingOverId, setTakingOverId] = useState<string | null>(null);
  const [humanInput, setHumanInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return tickets;
    return tickets.filter((t) => t.status === filter);
  }, [tickets, filter]);

  const exportToExcel = () => {
    const headers = ["Priority", "Title", "Summary", "Status", "Created At", "Conversation ID"];
    const rows = filtered.map((t) => [
      `P${t.priority_level}`,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${(t.ai_summary ?? "").replace(/"/g, '""').slice(0, 200)}"`,
      t.status,
      formatDate(t.created_at),
      t.conversation_id,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `repllyer-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("success", `Exported ${filtered.length} tickets to CSV (Excel compatible)`);
  };

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const viewChat = async (t: Ticket) => {
    setSelected(t);
    setChat(null);
    setIsChatLoading(true);
    try {
      const res = await fetch(`/api/dashboard/conversation?conversationId=${encodeURIComponent(t.conversation_id)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load chat");
      setChat(json.messages ?? []);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setIsChatLoading(false);
    }
  };

  const takeOver = async (t: Ticket) => {
    setTakingOverId(t.id);
    try {
      const res = await fetch("/api/dashboard/tickets/takeover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: t.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Take over failed");
      setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: "escalated" } : x)));
      if (selected?.id === t.id) setSelected((s) => (s ? { ...s, status: "escalated" } : s));
      showToast("success", "Ticket escalated — human takeover. You can now reply.");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setTakingOverId(null);
    }
  };

  const sendHumanReply = async () => {
    if (!selected || !humanInput.trim()) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/dashboard/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selected.conversation_id, content: humanInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to send");
      // Optimistically append
      const newMsg: ChatMessage = { role: "ai", content: humanInput.trim(), attachment_url: null, timestamp: new Date().toISOString() };
      setChat((prev) => (prev ? [...prev, newMsg] : [newMsg]));
      setHumanInput("");
      showToast("success", "Reply sent to customer");
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {([
          { k: "all", label: "All" },
          { k: "auto_resolved", label: "Auto-resolved" },
          { k: "pending_human", label: "Pending" },
          { k: "escalated", label: "Escalated" },
        ] as const).map(({ k, label }) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-4 py-2 text-xs font-medium transition ${
              filter === k ? "bg-white text-black" : "border border-neutral-800 bg-black text-neutral-400 hover:bg-neutral-900 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={exportToExcel}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-black px-4 py-2 text-xs font-medium text-white hover:bg-neutral-900"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
          Export Excel
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[24px] border border-neutral-800 bg-neutral-950 p-10 text-center">
          <p className="text-sm text-neutral-500">No tickets in this filter.</p>
          <p className="mt-1 text-xs text-neutral-600">Ingest knowledge and chat at /chat-demo to generate tickets.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((t, i) => {
              const pri = priorityLabel(t.priority_level);
              const st = statusBadge(t.status);
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: i * 0.02, type: "spring", stiffness: 400, damping: 30 }}
                  whileHover={{ scale: 1.01 }}
                  className="rounded-[20px] border border-neutral-800 bg-neutral-950 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tracking-tight ${pri.cls}`}>{pri.text}</span>
                        <span className={`rounded-full border px-2.5 py-1 text-xs ${st.cls}`}>{st.label}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-600" suppressHydrationWarning>
                          <Clock className="h-3 w-3" />
                          {formatDate(t.created_at)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-sm font-semibold leading-tight text-white">{t.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">{t.ai_summary ?? "—"}</p>
                    </div>
                    <div className="flex shrink-0 gap-2 sm:flex-col lg:flex-row">
                      <button onClick={() => viewChat(t)} className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-black px-3.5 py-2 text-xs font-medium text-white hover:bg-neutral-900">
                        <Eye className="h-3.5 w-3.5" /> View Chat
                      </button>
                      <button onClick={() => takeOver(t)} disabled={takingOverId === t.id || t.status === "escalated"} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-black hover:bg-neutral-200 disabled:opacity-50">
                        <UserCheck className="h-3.5 w-3.5" /> {takingOverId === t.id ? "…" : "Take Over"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => { setSelected(null); setChat(null); }} />
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[92%] max-w-[640px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border border-neutral-800 bg-neutral-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
                <div>
                  <p className="text-sm font-semibold text-white">{selected.title}</p>
                  <p className="text-xs text-neutral-500">Priority {selected.priority_level} · {selected.status}</p>
                </div>
                <button onClick={() => { setSelected(null); setChat(null); }} className="rounded-full p-2 text-neutral-500 hover:bg-neutral-900 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-black p-4">
                {isChatLoading ? (
                  <div className="flex items-center gap-2 py-10 justify-center text-sm text-neutral-500">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
                    Loading chat…
                  </div>
                ) : !chat || chat.length === 0 ? (
                  <div className="py-10 text-center text-sm text-neutral-600">No messages found for this conversation.</div>
                ) : (
                  <div className="space-y-3">
                    {chat.map((m, idx) => (
                      <div key={idx} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-white text-black" : "border border-neutral-800 bg-neutral-950 text-white"}`}>
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          {m.attachment_url && (
                            <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs underline decoration-neutral-600 hover:decoration-white">
                              Attachment <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <p className="mt-1 text-[11px] opacity-60" suppressHydrationWarning>{formatDate(m.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Human reply area — only when escalated / taken over */}
              {selected.status === "escalated" ? (
                <div className="border-t border-neutral-800 bg-neutral-950 p-3">
                  <div className="flex gap-2">
                    <input
                      value={humanInput}
                      onChange={(e) => setHumanInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendHumanReply(); } }}
                      placeholder="Reply as human..."
                      className="flex-1 rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white"
                    />
                    <button onClick={sendHumanReply} disabled={isSending || !humanInput.trim()} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-black hover:bg-neutral-200 disabled:opacity-50">
                      {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-neutral-600">You are now chatting as human. Customer will see this in widget.</p>
                </div>
              ) : (
                <div className="border-t border-neutral-800 px-6 py-4">
                  <button onClick={() => takeOver(selected)} disabled={takingOverId === selected.id} className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50">
                    {takingOverId === selected.id ? "Taking over…" : "Take over to reply"}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur-md ${toast.type === "success" ? "border-neutral-800 bg-white text-black" : "border-neutral-800 bg-black text-white"}`}>
            {toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
