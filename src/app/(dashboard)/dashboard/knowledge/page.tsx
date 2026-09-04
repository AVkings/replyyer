"use client";
import { useEffect, useState } from "react";
import { useBiz } from "@/components/dashboard/BizContext";
import { createBrowserClient } from "@/lib/supabase-browser";
import { motion } from "framer-motion";

export default function Knowledge() {
  const { selected } = useBiz();
  const [kbText, setKbText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [files, setFiles] = useState<{ filename: string; gofile_url: string; created_at: string }[]>([]);

  const load = async () => {
    if (!selected) return;
    const supa = createBrowserClient();
    const { data } = await supa.from("kb_files").select("filename, gofile_url, created_at").eq("business_id", selected).order("created_at", { ascending: false }).limit(20);
    setFiles((data as typeof files) || []);
  };
  useEffect(() => { load(); }, [selected]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const form = new FormData();
    form.append("business_id", selected);
    if (file) form.append("file", file);
    else if (kbText) form.append("raw_text", kbText);
    else return setMsg("Pick file or paste text");
    const r = await fetch("/api/kb/upload", { method: "POST", body: form });
    const j = await r.json();
    setMsg(r.ok ? "Saved securely" : j.error);
    if (r.ok) load();
  }

  return (
    <div className="space-y-6">
      <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-lg font-semibold">Knowledge base</motion.h1>
      <motion.form initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} onSubmit={upload} className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Upload PDF/DOCX/TXT (≤20MB)</label>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm" />
            <p className="mt-1 text-[11px] text-zinc-500">Encrypted storage — only your AI can read it.</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Or paste text KB (Q&A, policies, product list)</label>
            <textarea value={kbText} onChange={(e) => setKbText(e.target.value)} rows={5} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" placeholder="e.g. Returns: 30 days..." />
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.98 }} className="rounded-full bg-black px-4 py-2 text-xs font-medium text-white">Save</motion.button>
        {msg && <p className="text-xs text-zinc-600">{msg}</p>}
      </motion.form>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold">Files</div>
        <div className="mt-3 space-y-2">
          {files.length === 0 && <div className="text-xs text-zinc-500">No files yet.</div>}
          {files.map((f) => (
            <motion.div key={f.gofile_url} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between rounded-xl border border-zinc-100 px-3 py-2 text-xs">
              <span className="font-medium">{f.filename}</span>
              <a href={f.gofile_url} target="_blank" className="underline">View</a>
              <span className="text-zinc-500">{new Date(f.created_at).toLocaleDateString()}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
