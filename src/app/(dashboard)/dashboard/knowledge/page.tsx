"use client";
import { useEffect, useState } from "react";
import { useBiz } from "@/components/dashboard/BizContext";
import { createBrowserClient } from "@/lib/supabase-browser";
import { motion } from "framer-motion";
import { RepllyerLoader } from "@/components/Loader";

type FileRow = { id: string; filename: string; gofile_url: string; created_at: string; size: number | null };
type TextRow = { id: string; raw_text: string; created_at: string };

export default function Knowledge() {
  const { selected } = useBiz();
  const [kbText, setKbText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [texts, setTexts] = useState<TextRow[]>([]);

  const load = async () => {
    if (!selected) return;
    setLoading(true);
    const supa = createBrowserClient();
    const [f, t] = await Promise.all([
      supa.from("kb_files").select("id, filename, gofile_url, created_at, size").eq("business_id", selected).order("created_at", { ascending: false }).limit(30),
      supa.from("knowledge_bases").select("id, raw_text, created_at").eq("business_id", selected).order("created_at", { ascending: false }).limit(30),
    ]);
    setFiles((f.data as FileRow[]) || []);
    setTexts((t.data as TextRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function uploadText() {
    if (!selected) return setMsg("Select a business first (Settings).");
    if (!kbText.trim()) return setMsg("Paste some text first.");
    setBusy(true);
    setMsg("");
    try {
      const form = new FormData();
      form.append("business_id", selected);
      form.append("raw_text", kbText.trim());
      const r = await fetch("/api/kb/upload", { method: "POST", body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "save failed");
      setKbText("");
      setMsg("Text saved — AI will use it instantly.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile() {
    if (!selected) return setMsg("Select a business first (Settings).");
    if (!file) return setMsg("Choose a file first.");
    if (file.size > 20 * 1024 * 1024) return setMsg("Max 20MB.");
    setBusy(true);
    setMsg("");
    try {
      const form = new FormData();
      form.append("business_id", selected);
      form.append("file", file);
      const r = await fetch("/api/kb/upload", { method: "POST", body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "upload failed");
      setFile(null);
      const el = document.getElementById("kb-file-input") as HTMLInputElement | null;
      if (el) el.value = "";
      setMsg("File uploaded securely.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string, type: "file" | "text") {
    if (!confirm("Delete this item? AI will stop using it.")) return;
    const r = await fetch(`/api/kb/${id}?type=${type}&business_id=${selected}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(j.error || "delete failed");
    setMsg("Deleted.");
    load();
  }

  if (!selected) return <div className="text-sm text-zinc-500">Select a business in Settings to manage knowledge.</div>;

  return (
    <div className="space-y-5">
      <div>
        <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-lg font-semibold">Knowledge base</motion.h1>
        <p className="text-xs text-zinc-500">Files + pasted text. AI answers ONLY from this. Newest is used first.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-sm font-semibold">Add text</div>
          <p className="text-[11px] text-zinc-500">Q&A, policies, product list, timings…</p>
          <textarea value={kbText} onChange={(e) => setKbText(e.target.value)} rows={6} placeholder={"e.g.\nReturns: 30 days, refund in 5-7 days.\nTiming: 10am-9pm.\nDelivery: 2-4 days."} className="mt-3 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-black" />
          <div className="mt-3 flex items-center gap-2">
            <motion.button whileTap={{ scale: 0.97 }} onClick={uploadText} disabled={busy} className="rounded-full bg-black px-5 py-2 text-xs font-medium text-white disabled:opacity-50">
              {busy ? "Saving…" : "Save text"}
            </motion.button>
            <span className="text-[11px] text-zinc-400">{kbText.length}/50000</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-sm font-semibold">Upload file</div>
          <p className="text-[11px] text-zinc-500">PDF / DOCX / TXT, up to 20MB. Encrypted storage.</p>
          <label className="mt-3 block cursor-pointer rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-xs text-zinc-600 hover:border-black">
            <input id="kb-file-input" type="file" accept=".pdf,.docx,.doc,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
            {file ? <span className="font-medium text-black">{file.name} ({(file.size / 1024).toFixed(0)} KB) — click to change</span> : <span>Click to choose file</span>}
          </label>
          <motion.button whileTap={{ scale: 0.97 }} onClick={uploadFile} disabled={busy || !file} className="mt-3 rounded-full bg-black px-5 py-2 text-xs font-medium text-white disabled:opacity-50">
            {busy ? "Uploading…" : "Upload file"}
          </motion.button>
        </motion.div>
      </div>

      {msg && <div className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs">{msg}</div>}

      {loading ? (
        <RepllyerLoader label="Loading knowledge…" />
      ) : (
        <>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Saved texts — {texts.length}</div>
              <button onClick={load} className="text-xs text-zinc-500 hover:text-black">Refresh</button>
            </div>
            <div className="mt-3 space-y-2">
              {texts.length === 0 && <div className="text-xs text-zinc-500">No texts yet — paste above.</div>}
              {texts.map((t) => (
                <div key={t.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                  <div className="whitespace-pre-wrap text-xs leading-5">{t.raw_text.slice(0, 400)}{t.raw_text.length > 400 ? "…" : ""}</div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>{new Date(t.created_at).toLocaleString()}</span>
                    <button onClick={() => del(t.id, "text")} className="rounded-full border border-zinc-200 bg-white px-3 py-1 hover:border-red-400 hover:text-red-600">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="text-sm font-semibold">Files — {files.length}</div>
            <div className="mt-3 space-y-2">
              {files.length === 0 && <div className="text-xs text-zinc-500">No files yet.</div>}
              {files.map((f) => (
                <div key={f.id} className="flex flex-wrap items-center gap-2 justify-between rounded-xl border border-zinc-100 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{f.filename}</div>
                    <div className="text-[11px] text-zinc-500">{f.size ? `${(f.size / 1024).toFixed(0)} KB • ` : ""}{new Date(f.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <a href={f.gofile_url} target="_blank" rel="noreferrer" className="rounded-full border border-zinc-200 px-3 py-1 hover:border-black">View</a>
                    <button onClick={() => del(f.id, "file")} className="rounded-full border border-zinc-200 px-3 py-1 hover:border-red-400 hover:text-red-600">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
