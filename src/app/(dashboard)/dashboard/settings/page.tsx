"use client";
import { useEffect, useState } from "react";
import { useBiz } from "@/components/dashboard/BizContext";
import { createBrowserClient } from "@/lib/supabase-browser";
import { motion } from "framer-motion";
import { RepllyerLoader } from "@/components/Loader";

type ApiKeyRow = { id: string; prefix: string; is_active: boolean; created_at: string };
type BusinessRow = { id: string; name: string; domain: string | null; description: string | null; webhook_url?: string | null; created_at: string };

export default function Settings() {
  const { selected, bizs, refresh, setSelected } = useBiz();
  const biz = bizs.find((b) => b.id === selected) as BusinessRow | undefined;
  const [userData, setUserData] = useState<{ email: string; id: string } | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [form, setForm] = useState({ name: "", domain: "", description: "", webhook_url: "" });
  const [createForm, setCreateForm] = useState({ name: "", domain: "", description: "" });
  const [apiKey, setApiKey] = useState("");
  const [msg, setMsg] = useState("");
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const supa = createBrowserClient();
    supa.auth.getUser().then(({ data }) => {
      if (data.user) setUserData({ email: data.user.email || "-", id: data.user.id });
    });
  }, []);

  useEffect(() => {
    if (biz) setForm({ name: biz.name || "", domain: biz.domain || "", description: biz.description || "", webhook_url: biz.webhook_url || "" });
  }, [biz?.id]);

  const loadKeys = async (bizId: string) => {
    if (!bizId) return;
    setLoadingKeys(true);
    const supa = createBrowserClient();
    const { data } = await supa.from("api_keys").select("id, prefix, is_active, created_at").eq("business_id", bizId).order("created_at", { ascending: false });
    setKeys((data as ApiKeyRow[]) || []);
    setLoadingKeys(false);
  };
  useEffect(() => {
    if (selected) loadKeys(selected);
  }, [selected]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setMsg("Copy failed — select manually.");
    }
  };

  async function createBiz(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.name.trim()) return setMsg("Business name required.");
    setCreating(true);
    setMsg("");
    try {
      const r = await fetch("/api/businesses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(createForm) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "create failed");
      setApiKey(j.api_key);
      setMsg("Created. Save your API key now — it shows only once.");
      setCreateForm({ name: "", domain: "", description: "" });
      await refresh();
      if (j.business?.id) setSelected(j.business.id);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "create failed");
    } finally {
      setCreating(false);
    }
  }

  async function regen() {
    if (!selected) return;
    setLoadingKeys(true);
    const r = await fetch(`/api/businesses/${selected}/api-key`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setApiKey(j.api_key);
      setMsg("New key generated. Old keys revoked.");
      await loadKeys(selected);
    } else setMsg(j.error || "regen failed");
    setLoadingKeys(false);
  }

  async function saveBiz(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMsg("");
    try {
      const supa = createBrowserClient();
      const payload: Record<string, string> = {};
      if (form.name.trim()) payload.name = form.name.trim();
      if (form.domain.trim()) payload.domain = form.domain.trim();
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.webhook_url.trim()) payload.webhook_url = form.webhook_url.trim();
      if (Object.keys(payload).length === 0) throw new Error("Nothing to save.");
      const { error } = await supa.from("businesses").update(payload).eq("id", selected);
      if (error) throw new Error(error.message);
      setMsg("Saved.");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-lg font-semibold">Settings</motion.h1>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-sm font-semibold">Your account</div>
          {userData ? (
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2">
                <span className="text-zinc-500">Email</span>
                <span className="font-mono truncate max-w-[60%]">{userData.email}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 gap-2">
                <span className="text-zinc-500 shrink-0">User ID</span>
                <span className="font-mono text-[11px] truncate">{userData.id}</span>
                <button onClick={() => copy(userData.id, "uid")} className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px]">{copied === "uid" ? "Copied!" : "Copy"}</button>
              </div>
            </div>
          ) : (
            <RepllyerLoader label="Loading account…" />
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Businesses — {bizs.length}</div>
            <span className="text-[11px] text-zinc-500">+100 credits after first</span>
          </div>
          <div className="mt-3 max-h-[220px] overflow-y-auto space-y-2 pr-1">
            {(bizs as BusinessRow[]).map((b) => (
              <div key={b.id} className={`rounded-xl border p-3 text-xs ${selected === b.id ? "border-black bg-black text-white" : "border-zinc-200 bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{b.name}</span>
                  <button onClick={() => setSelected(b.id)} className={`shrink-0 rounded-full px-3 py-1 ${selected === b.id ? "bg-white text-black" : "bg-black text-white"}`}>
                    {selected === b.id ? "Selected" : "Select"}
                  </button>
                </div>
                <div className={`mt-1 flex items-center gap-2 font-mono text-[11px] ${selected === b.id ? "text-zinc-300" : "text-zinc-500"}`}>
                  <span className="truncate">ID: {b.id}</span>
                  <button onClick={() => copy(b.id, b.id)} className={`shrink-0 rounded-full border px-2 py-0.5 ${selected === b.id ? "border-zinc-600" : "border-zinc-200"}`}>{copied === b.id ? "Copied" : "Copy"}</button>
                </div>
                <div className={selected === b.id ? "text-zinc-300" : "text-zinc-500"}>{b.domain || "no domain"}</div>
              </div>
            ))}
            {bizs.length === 0 && <div className="text-xs text-zinc-500">No businesses — create one below.</div>}
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">API access — {biz?.name || "no business selected"}</div>
          <button onClick={regen} disabled={!selected || loadingKeys} className="rounded-full bg-black px-4 py-1.5 text-xs text-white disabled:opacity-50">
            {loadingKeys ? "Working…" : "Regenerate key"}
          </button>
        </div>
        {biz && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs">
            <span className="text-zinc-500 shrink-0">Business ID</span>
            <span className="font-mono text-[11px] truncate flex-1">{biz.id}</span>
            <button onClick={() => copy(biz.id, "biz")} className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px]">{copied === "biz" ? "Copied!" : "Copy"}</button>
          </div>
        )}
        <div className="mt-3">
          {loadingKeys ? (
            <RepllyerLoader label="Loading keys…" />
          ) : keys.length === 0 ? (
            <div className="text-xs text-zinc-500">No keys yet — regenerate to create one.</div>
          ) : (
            <div className="space-y-1.5">
              {keys.map((k) => (
                <div key={k.id} className="flex flex-wrap items-center gap-2 justify-between rounded-xl border border-zinc-100 px-3 py-2 text-xs">
                  <span className="font-mono">{k.prefix}••••••••••••</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${k.is_active ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"}`}>{k.is_active ? "active" : "revoked"}</span>
                  <span className="text-zinc-500">{new Date(k.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {apiKey && (
          <div className="mt-3 rounded-xl bg-zinc-950 p-3">
            <div className="break-all font-mono text-xs text-lime-300">{apiKey}</div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => copy(apiKey, "key")} className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-black">{copied === "key" ? "Copied!" : "Copy key"}</button>
              <span className="text-[11px] text-zinc-500">Shows once — store safely.</span>
            </div>
          </div>
        )}
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs">
          Base URL <code className="font-mono font-semibold">https://repllyer.vercel.app</code> • Header <code className="font-mono">x-api-key: rply_live_…</code> • No email needed — bot asks or uses guest.
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2">
        <motion.form onSubmit={saveBiz} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-2">
          <div className="text-sm font-semibold">Edit current business</div>
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-black" />
          <input placeholder="Domain (example.com)" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-black" />
          <input placeholder="Webhook URL (optional)" value={form.webhook_url} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-black" />
          <textarea placeholder="What do you sell?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-black" />
          <button disabled={saving || !selected} className="w-full rounded-full bg-black py-2 text-xs font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button>
        </motion.form>

        <motion.form onSubmit={createBiz} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl bg-black p-5 space-y-2 text-white">
          <div className="text-sm font-semibold">New business <span className="font-normal text-zinc-400 text-xs">— 100 credits after first</span></div>
          <input placeholder="Name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-white" />
          <input placeholder="Domain (optional)" value={createForm.domain} onChange={(e) => setCreateForm({ ...createForm, domain: e.target.value })} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-white" />
          <textarea placeholder="What does it sell?" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} rows={3} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-white" />
          <button disabled={creating} className="w-full rounded-full bg-white py-2 text-xs font-medium text-black disabled:opacity-50">{creating ? "Creating…" : "Create business"}</button>
        </motion.form>
      </div>

      {msg && <div className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs">{msg}</div>}
    </div>
  );
}
