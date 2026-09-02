"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Key, Building2, Globe, Eye, EyeOff, Database, Sparkles } from "lucide-react";
import IngestForm from "@/components/knowledge/IngestForm";

export default function SettingsClient({
  org,
  email,
}: {
  org: { id: string; name: string; domain: string | null; api_key: string };
  email: string;
}) {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(org.api_key);
      setCopied(true);
      setToast("API key copied to clipboard");
      setTimeout(() => {
        setCopied(false);
        setToast(null);
      }, 2500);
    } catch {
      setToast("Clipboard failed — copy manually");
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Org card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="rounded-[24px] border border-neutral-800 bg-neutral-950 p-6 sm:p-8"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
            <Building2 className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-semibold tracking-tight">Organization</h2>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-widest text-neutral-500">Name</label>
            <div className="rounded-2xl border border-neutral-800 bg-black px-4 py-3.5 text-sm text-white">{org.name}</div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-widest text-neutral-500">Domain</label>
            <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-black px-4 py-3.5 text-sm text-white">
              <Globe className="h-4 w-4 text-neutral-500" />
              {org.domain ?? "—"}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-widest text-neutral-500">Owner email</label>
            <div className="rounded-2xl border border-neutral-800 bg-black px-4 py-3.5 text-sm text-white">{email}</div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-widest text-neutral-500">Organization ID</label>
            <div className="rounded-2xl border border-neutral-800 bg-black px-4 py-3.5 font-mono text-xs text-neutral-300">{org.id}</div>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-neutral-500">
            <Key className="h-3.5 w-3.5" /> API Key <span className="text-neutral-600">(only here after login)</span>
          </label>
          <div className="flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-2xl border border-neutral-800 bg-black px-4 py-3.5">
              <span className="flex-1 font-mono text-sm text-white break-all">
                {showKey ? org.api_key : "•".repeat(32) + org.api_key.slice(-6)}
              </span>
              <button
                onClick={() => setShowKey((v) => !v)}
                className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-900 hover:text-white"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={copyKey}
              className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black hover:bg-neutral-200"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </motion.button>
          </div>
          <p className="text-xs leading-relaxed text-neutral-600">
            Use this key to scope your widget/ingest calls. Never expose in public client code — pass via server.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
          <p className="text-xs font-medium text-white">Embed snippet (iframe)</p>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-neutral-950 p-3 text-xs leading-relaxed text-neutral-300">
            {`<iframe src="https://repllyer.pages.dev/chat-demo?org=${org.id}" width="400" height="560" style="border:0;border-radius:28px"></iframe>`}
          </pre>
        </div>
      </motion.div>

      {/* Knowledge ingest — same form but B&W-themed wrapper */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, type: "spring", stiffness: 400, damping: 30 }}
        className="rounded-[24px] border border-neutral-800 bg-neutral-950 p-6 sm:p-8"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Knowledge Base</h2>
            <p className="text-xs text-neutral-500">Ingestion is scoped to this organization.</p>
          </div>
        </div>
        <div className="mt-6 rounded-[20px] border border-neutral-800 bg-black p-6">
          {/* Pre-fill org id via hidden field trick: we render IngestForm but it will auto-resolve to this org when empty; we show org id for clarity */}
          <p className="mb-4 text-xs text-neutral-500">
            Organization: <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-white">{org.id}</code> — leave Org ID empty to use this one.
          </p>
          <IngestForm />
        </div>
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed bottom-6 right-6 z-50 rounded-2xl border border-neutral-800 bg-white px-4 py-3 text-sm font-medium text-black shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
