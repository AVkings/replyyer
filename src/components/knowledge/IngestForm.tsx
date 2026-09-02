"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link as LinkIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Database,
  FileText,
  X,
  Building2,
  FileJson,
} from "lucide-react";
import { ingestKnowledgeBaseAction, ingestTextKnowledgeBaseAction, type IngestResult } from "@/lib/knowledge/actions";

type ModalState = { open: boolean; type: "success" | "error"; title: string; message: string; details?: string };

export default function IngestForm() {
  const [tab, setTab] = useState<"url" | "paste">("url");
  const [url, setUrl] = useState("");
  const [paste, setPaste] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [orgId, setOrgId] = useState("");
  const [result, setResult] = useState<IngestResult | null>(null);
  const [modal, setModal] = useState<ModalState>({ open: false, type: "success", title: "", message: "" });
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "url") {
      if (!url.trim()) {
        setModal({ open: true, type: "error", title: "URL required", message: "Please paste a URL to ingest." });
        return;
      }
      const fd = new FormData();
      fd.set("url", url.trim());
      if (orgId.trim()) fd.set("organizationId", orgId.trim());
      setResult(null);
      startTransition(async () => {
        const res = await ingestKnowledgeBaseAction(fd);
        setResult(res);
        if (res.success) setModal({ open: true, type: "success", title: "Knowledge ingested!", message: `${res.chunksIngested} chunks from ${res.title || res.url} • ${res.totalChars.toLocaleString()} chars` });
        else setModal({ open: true, type: "error", title: "Ingestion failed", message: res.error, details: res.details });
      });
    } else {
      if (!paste.trim() || paste.trim().length < 20) {
        setModal({ open: true, type: "error", title: "Text required", message: "Paste at least 20 characters (docs, JSON, CSV, DB export)." });
        return;
      }
      const fd = new FormData();
      fd.set("text", paste.trim());
      if (pasteTitle.trim()) fd.set("title", pasteTitle.trim());
      if (orgId.trim()) fd.set("organizationId", orgId.trim());
      setResult(null);
      startTransition(async () => {
        const res = await ingestTextKnowledgeBaseAction(fd);
        setResult(res);
        if (res.success) setModal({ open: true, type: "success", title: "Knowledge ingested!", message: `${res.chunksIngested} chunks from "${res.title}" • ${res.totalChars.toLocaleString()} chars` });
        else setModal({ open: true, type: "error", title: "Ingestion failed", message: res.error, details: res.details });
      });
    }
  };

  return (
    <>
      {/* Tabs */}
      <div className="mb-5 flex rounded-2xl border border-neutral-800 bg-black p-1">
        <button
          type="button"
          onClick={() => setTab("url")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium transition ${tab === "url" ? "bg-white text-black" : "text-neutral-500 hover:text-white"}`}
        >
          <LinkIcon className="h-3.5 w-3.5" /> URL
        </button>
        <button
          type="button"
          onClick={() => setTab("paste")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium transition ${tab === "paste" ? "bg-white text-black" : "text-neutral-500 hover:text-white"}`}
        >
          <FileJson className="h-3.5 w-3.5" /> Paste Text / JSON / DB
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <AnimatePresence mode="wait">
          {tab === "url" ? (
            <motion.div
              key="url"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="space-y-2"
            >
              <label htmlFor="kb-url" className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-neutral-400">
                <LinkIcon className="h-4 w-4 text-white" /> URL to learn from
              </label>
              <div className="relative">
                <input
                  id="kb-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://your-docs.com/help/getting-started"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isPending}
                  className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3.5 pr-12 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-white focus:ring-4 focus:ring-white/10 disabled:opacity-60"
                  required={tab === "url"}
                />
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <span className="rounded-full bg-white p-1.5 text-black">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
              <p className="text-xs text-neutral-500">Extracts headings, paragraphs & lists — scripts/styles/nav stripped. Fast.</p>
            </motion.div>
          ) : (
            <motion.div
              key="paste"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="space-y-3"
            >
              <label htmlFor="kb-title" className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-neutral-400">
                <FileText className="h-4 w-4 text-white" /> Title <span className="normal-case tracking-normal text-neutral-600">(optional, e.g., FAQ JSON)</span>
              </label>
              <input
                id="kb-title"
                type="text"
                placeholder="My Knowledge Base — FAQs"
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
                disabled={isPending}
                className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white focus:ring-4 focus:ring-white/10"
              />
              <label htmlFor="kb-paste" className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-neutral-400">
                <FileJson className="h-4 w-4 text-white" /> Paste text / JSON / CSV / DB dump
              </label>
              <textarea
                id="kb-paste"
                placeholder='Paste anything: docs, {"faqs":[{"q":"...","a":"..."}]}, CSV, Notion export, DB dump...'
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                disabled={isPending}
                rows={8}
                className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white focus:ring-4 focus:ring-white/10 disabled:opacity-60"
                required={tab === "paste"}
              />
              <p className="text-xs text-neutral-500">{paste.length.toLocaleString()} chars • Will be chunked 700+100, same pipeline as URL.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          <label htmlFor="kb-org" className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-neutral-400">
            <Building2 className="h-4 w-4 text-neutral-500" /> Organization ID <span className="font-normal normal-case tracking-normal text-neutral-600">(optional)</span>
          </label>
          <input
            id="kb-org"
            type="text"
            placeholder="Auto-creates Demo Org if empty"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            disabled={isPending}
            className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-white focus:ring-4 focus:ring-white/10 disabled:opacity-60"
          />
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: isPending ? 1 : 1.01 }}
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {tab === "url" ? "Scraping & embedding…" : "Embedding pasted text…"}
            </>
          ) : (
            <>
              <Database className="h-4 w-4" /> Ingest & Embed
            </>
          )}
        </motion.button>
      </form>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.success ? "success" : "error"}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="mt-6 overflow-hidden rounded-2xl border border-neutral-800 bg-black"
          >
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-white p-2 text-black">{result.success ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}</div>
                <div className="flex-1">
                  {result.success ? (
                    <>
                      <h3 className="text-sm font-semibold text-white">Indexed successfully</h3>
                      <p className="mt-1 text-sm text-neutral-400">
                        <span className="font-medium text-white">{result.title}</span> — {result.chunksIngested} chunks • {result.totalChars.toLocaleString()} chars
                      </p>
                      <p className="mt-1 break-all text-xs text-neutral-600">{result.url}</p>
                      <p className="mt-1 text-xs text-neutral-600">
                        Org: <code className="rounded border border-neutral-800 bg-neutral-950 px-1 py-0.5 text-white">{result.organizationId}</code>
                      </p>
                      {result.previewChunks && result.previewChunks.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
                            <FileText className="h-3 w-3" /> Preview (first 3 chunks)
                          </p>
                          <div className="grid gap-2">
                            {result.previewChunks.map((c, i) => (
                              <div key={i} className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs leading-relaxed text-neutral-300">
                                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Chunk {i + 1}</span>
                                {c.slice(0, 400)}
                                {c.length > 400 && "…"}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <h3 className="text-sm font-semibold text-white">Ingestion failed</h3>
                      <p className="mt-1 text-sm text-neutral-300">{result.error}</p>
                      {result.details && <p className="mt-2 rounded-lg border border-neutral-800 bg-neutral-950 p-2 text-xs text-neutral-500">{result.details}</p>}
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal.open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setModal((m) => ({ ...m, open: false }))} />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[20px] border border-neutral-800 bg-neutral-950 p-6 shadow-2xl"
            >
              <button onClick={() => setModal((m) => ({ ...m, open: false }))} className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-500 hover:bg-neutral-900 hover:text-white">
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-white p-3 text-black">{modal.type === "success" ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}</div>
                <div className="flex-1 pr-2">
                  <h4 className="text-sm font-semibold text-white">{modal.title}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-400">{modal.message}</p>
                  {modal.details && <p className="mt-3 rounded-xl border border-neutral-800 bg-black p-3 text-xs text-neutral-500">{modal.details}</p>}
                </div>
              </div>
              <button onClick={() => setModal((m) => ({ ...m, open: false }))} className="mt-6 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-neutral-200">
                Got it
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
