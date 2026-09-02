"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Paperclip,
  Bot,
  User,
  X,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  ExternalLink,
  MessageCircle,
  Trash2,
  Minimize2,
} from "lucide-react";

type ChatMsg = {
  id: string;
  role: "user" | "ai";
  content: string;
  attachmentUrl?: string | null;
  ticketCreated?: { ticketId: string; title: string } | null;
  sources?: { url_source: string | null; similarity: number }[] | null;
};

type Toast = { id: string; type: "error" | "success" | "info"; message: string };

type AIChatWidgetProps = {
  organizationId?: string;
  apiKey?: string;
  customerEmail?: string;
  defaultOpen?: boolean;
  variant?: "floating" | "inline";
  title?: string;
  subtitle?: string;
};

export default function AIChatWidget({
  organizationId,
  apiKey,
  customerEmail,
  defaultOpen = true,
  variant = "floating",
  title = "Repllyer Support",
  subtitle = "AI • Replies instantly",
}: AIChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "welcome",
      role: "ai",
      content:
        "Hi there! I'm Repllyer, your AI support assistant. Ask me anything about the product, or share a screenshot if something looks off.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 200);
  }, [isOpen]);

  // Poll for admin/human replies — fixes "admin types but customer doesn't see"
  useEffect(() => {
    if (!isOpen || !organizationId) return;
    // Only poll after at least one user message has been sent (so conversation exists)
    if (messages.filter((m) => m.role === "user").length === 0) return;
    const interval = setInterval(async () => {
      try {
        const headers: Record<string, string> = {};
        if (apiKey) headers["x-api-key"] = apiKey;
        // Prefer conversationId if we have it, else sessionId
        const url = conversationId
          ? `/api/chat/history?conversationId=${encodeURIComponent(conversationId)}`
          : `/api/chat/history?sessionId=${encodeURIComponent(sessionId)}&organizationId=${encodeURIComponent(organizationId)}`;
        const res = await fetch(url, { headers: Object.keys(headers).length ? headers : undefined });
        const j = await res.json();
        if (!j.messages || !Array.isArray(j.messages)) return;
        const serverMsgs: ChatMsg[] = j.messages.map((m: { role: string; content: string; attachment_url: string | null }, idx: number) => ({
          id: `srv_${idx}`,
          role: m.role === "user" ? "user" : "ai",
          content: m.content,
          attachmentUrl: m.attachment_url,
        }));
        setMessages((prev) => {
          const nonWelcome = prev.filter((m) => m.id !== "welcome" && m.id !== "welcome2");
          // If server has more messages than local (admin replied), append missing ones
          if (serverMsgs.length > nonWelcome.length) {
            const newOnes = serverMsgs.slice(nonWelcome.length).map((m) => ({ ...m, id: `srv_${Date.now()}_${Math.random().toString(36).slice(2, 4)}` }));
            // Avoid duplicates by content check
            const filtered = newOnes.filter((n) => !prev.some((p) => p.content === n.content && p.role === n.role));
            if (filtered.length) return [...prev, ...filtered];
          }
          return prev;
        });
        if (j.conversationId && !conversationId) setConversationId(j.conversationId);
      } catch {}
    }, 2500);
    return () => clearInterval(interval);
  }, [isOpen, organizationId, apiKey, sessionId, conversationId, messages]);

  const pushToast = (type: Toast["type"], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 10 * 1024 * 1024) {
      pushToast("error", "File too large — max 10MB");
      return;
    }
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const headers: Record<string, string> = {};
      if (apiKey) headers["x-api-key"] = apiKey;
      if (organizationId) headers["x-organization-id"] = organizationId;
      const res = await fetch("/api/upload", { method: "POST", headers: Object.keys(headers).length ? headers : undefined, body: fd });
      const json = (await res.json()) as { success: boolean; url?: string; error?: string };
      if (!res.ok || !json.success || !json.url) throw new Error(json.error ?? "Upload failed");
      setPendingAttachment(json.url);
      pushToast("success", `Uploaded: ${file.name}`);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Upload failed — check GoFile token & network");
    } finally {
      setIsUploading(false);
    }
  };

  const clearChat = () => {
    setMessages([{ id: "welcome2", role: "ai", content: "Chat cleared. How can I help you today?" }]);
    setPendingAttachment(null);
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMsg = { id: `u_${Date.now()}`, role: "user", content: trimmed, attachmentUrl: pendingAttachment };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setPendingAttachment(null);
    setIsSending(true);

    const apiMessages = nextMessages
      .filter((m) => m.id !== "welcome" && m.id !== "welcome2")
      .map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content, attachment_url: m.attachmentUrl ?? null }));
    if (apiMessages.length === 0) apiMessages.push({ role: "user", content: trimmed, attachment_url: pendingAttachment });

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["x-api-key"] = apiKey;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: apiMessages,
          organizationId,
          organization_id: organizationId,
          sessionId,
          session_id: sessionId,
          customerEmail,
          customer_email: customerEmail,
          attachment_url: pendingAttachment,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        reply?: string;
        error?: string;
        conversationId?: string;
        ticketCreated?: { ticketId: string; title: string } | null;
        sources?: { url_source: string | null; similarity: number }[] | null;
      };
      if (!res.ok || !json.success) throw new Error(json.error ?? `Chat failed (${res.status})`);
      if (json.conversationId) setConversationId(json.conversationId);
      const aiMsg: ChatMsg = {
        id: `a_${Date.now()}`,
        role: "ai",
        content: json.reply ?? "Done!",
        ticketCreated: json.ticketCreated ?? null,
        sources: json.sources ?? null,
      };
      setMessages((m) => [...m, aiMsg]);
      if (json.ticketCreated) pushToast("success", `Ticket auto-resolved: ${json.ticketCreated.title}`);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Failed to get reply");
      setMessages((m) => [...m, { id: `a_err_${Date.now()}`, role: "ai", content: "Sorry — I hit an error reaching the support brain. Please try again." }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const WidgetCard = (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={`flex flex-col overflow-hidden rounded-[28px] border border-neutral-800 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-md ${
        variant === "inline" ? "h-[640px] w-full" : "h-[560px] w-[380px] sm:w-[400px]"
      }`}
    >
      {/* Header — B&W */}
      <div className="flex items-center justify-between gap-3 border-b border-neutral-800 bg-black px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-black">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-white">{title}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              {subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearChat} title="Clear chat" className="rounded-full p-2 text-neutral-500 hover:bg-neutral-900 hover:text-white transition">
            <Trash2 className="h-4 w-4" />
          </button>
          {variant === "floating" && (
            <button onClick={() => setIsOpen(false)} className="rounded-full p-2 text-neutral-500 hover:bg-neutral-900 hover:text-white transition">
              <Minimize2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => (variant === "floating" ? setIsOpen(false) : clearChat())} className="hidden rounded-full p-2 text-neutral-500 hover:bg-neutral-900 hover:text-white transition sm:flex">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages — B&W */}
      <div ref={listRef} className="flex-1 overflow-y-auto bg-black px-4 py-4">
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "ai" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-black">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className={`max-w-[78%] space-y-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`rounded-[18px] px-4 py-3 text-sm leading-relaxed ${
                      m.role === "user" ? "rounded-br-[6px] bg-white text-black" : "rounded-bl-[6px] border border-neutral-800 bg-neutral-950 text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    {m.attachmentUrl && (
                      <a
                        href={m.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                          m.role === "user"
                            ? "border-black/10 bg-black/5 text-black hover:bg-black/10"
                            : "border-neutral-800 bg-black text-white hover:bg-neutral-900"
                        }`}
                      >
                        <ImageIcon className="h-4 w-4 shrink-0" />
                        <span className="truncate">Attachment</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                      </a>
                    )}
                    {m.ticketCreated && (
                      <div className="mt-2 rounded-xl border border-neutral-800 bg-black px-3 py-2 text-xs text-white">
                        ✓ Auto-resolved — <code className="rounded bg-white px-1 text-black">{m.ticketCreated.ticketId.slice(0, 8)}</code> {m.ticketCreated.title}
                      </div>
                    )}
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.sources.slice(0, 3).map((s, i) => (
                          <a
                            key={i}
                            href={s.url_source ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-neutral-800 bg-black px-2 py-1 text-[11px] text-neutral-400 hover:text-white"
                          >
                            Source {i + 1}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className={`px-1 text-[11px] text-neutral-600 ${m.role === "user" ? "text-right" : "text-left"}`}>
                    {m.role === "user" ? (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" /> You
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Bot className="h-3 w-3" /> Repllyer
                      </span>
                    )}
                  </p>
                </div>
                {m.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-black">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {isSending && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </div>
              <div className="rounded-[18px] rounded-bl-[6px] border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-500">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-600 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-600 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-600 [animation-delay:300ms]" />
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {pendingAttachment && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="border-t border-neutral-800 bg-neutral-950 px-4 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 truncate text-xs text-neutral-400">
                <ImageIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{pendingAttachment}</span>
              </span>
              <button onClick={() => setPendingAttachment(null)} className="rounded-full p-1 text-neutral-500 hover:bg-neutral-900 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-t border-neutral-800 bg-black p-3">
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*,.pdf,.txt" className="hidden" onChange={handleFileSelect} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isUploading || isSending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-neutral-800 bg-black text-neutral-400 hover:bg-neutral-900 hover:text-white disabled:opacity-50"
            type="button"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={pendingAttachment ? "Add a message about this file…" : "Ask anything…"}
            disabled={isSending}
            className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-white focus:ring-4 focus:ring-white/10 disabled:opacity-60"
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={sendMessage}
            disabled={!input.trim() || isSending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-black hover:bg-neutral-200 disabled:opacity-40"
            type="button"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </motion.button>
        </div>
        <p className="mt-2 text-center text-[11px] text-neutral-600">
          Attachments stored in GoFile <code className="rounded border border-neutral-800 bg-neutral-950 px-1 text-white">repllyer</code> folder.
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-[72px] left-3 right-3 z-20 space-y-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              className={`pointer-events-auto rounded-2xl border px-3 py-2.5 text-xs font-medium shadow-lg backdrop-blur-md ${
                t.type === "error" ? "border-neutral-800 bg-black text-white" : t.type === "success" ? "border-neutral-800 bg-white text-black" : "border-neutral-800 bg-neutral-950 text-white"
              }`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );

  if (variant === "inline") return WidgetCard;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      <AnimatePresence>{isOpen && WidgetCard}</AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.03 }}
        onClick={() => setIsOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-xl"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span key="open" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}>
              <MessageCircle className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
