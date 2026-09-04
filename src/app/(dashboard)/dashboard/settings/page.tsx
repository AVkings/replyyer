"use client";
import { useEffect, useState } from "react";
import { useBiz } from "@/components/dashboard/BizContext";
import { createBrowserClient } from "@/lib/supabase-browser";
import { motion } from "framer-motion";

type ApiKeyRow = { id: string; prefix: string; is_active: boolean; created_at: string };
type BusinessRow = { id: string; name: string; domain: string | null; description: string | null; created_at: string };

export default function Settings() {
  const { selected, bizs, refresh, setSelected } = useBiz();
  const biz = bizs.find((b) => b.id === selected) as BusinessRow | undefined;
  const [userData, setUserData] = useState<{ email: string; id: string; created_at: string } | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [allBizs, setAllBizs] = useState<BusinessRow[]>([]);
  const [form, setForm] = useState({ name: "", domain: "", description: "", webhook_url: "" });
  const [apiKey, setApiKey] = useState("");
  const [msg, setMsg] = useState("");
  const [loadingKeys, setLoadingKeys] = useState(false);

  useEffect(() => {
    const supa = createBrowserClient();
    supa.auth.getUser().then(({ data }) => {
      if (data.user) setUserData({ email: data.user.email || "-", id: data.user.id, created_at: (data.user as unknown as { created_at: string }).created_at || "" });
    });
  }, []);

  useEffect(() => {
    setAllBizs(bizs as BusinessRow[]);
  }, [bizs]);

  const loadKeys = async (bizId: string) => {
    if (!bizId) return;
    setLoadingKeys(true);
    const supa = createBrowserClient();
    const { data } = await supa.from("api_keys").select("id, prefix, is_active, created_at").eq("business_id", bizId).order("created_at", { ascending: false });
    setKeys((data as ApiKeyRow[]) || []);
    setLoadingKeys(false);
  };
  useEffect(() => { if (selected) loadKeys(selected); }, [selected]);

  async function createBiz(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/businesses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await r.json();
    if (r.ok) {
      setApiKey(j.api_key);
      setMsg(j.business ? `Created — 100 credits charged if not first. Save key now.` : "Created");
      refresh();
      if (j.business?.id) setSelected(j.business.id);
    } else setMsg(j.error || "error");
  }

  async function regen() {
    if (!selected) return;
    const r = await fetch(`/api/businesses/${selected}/api-key`, { method: "POST" });
    const j = await r.json();
    if (r.ok) { setApiKey(j.api_key); loadKeys(selected); }
    else setMsg(j.error);
  }

  async function updateBiz(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const supa = createBrowserClient();
    const { error } = await supa.from("businesses").update({ name: form.name || undefined, domain: form.domain || undefined, description: form.description || undefined, webhook_url: form.webhook_url || undefined }).eq("id", selected);
    setMsg(error ? error.message : "Saved");
    if (!error) refresh();
  }

  return (
    <div className="space-y-6">
      <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-lg font-semibold">Settings</motion.h1>

      {/* User data */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold">Your account</div>
        {userData ? (
          <div className="mt-3 grid gap-2 text-xs">
            <div className="flex justify-between rounded-xl bg-zinc-50 px-3 py-2"><span className="text-zinc-500">Email</span><span className="font-mono">{userData.email}</span></div>
            <div className="flex justify-between rounded-xl bg-zinc-50 px-3 py-2"><span className="text-zinc-500">User ID</span><span className="font-mono text-[11px]">{userData.id}</span></div>
            <div className="flex justify-between rounded-xl bg-zinc-50 px-3 py-2"><span className="text-zinc-500">Joined</span><span>{userData.created_at ? new Date(userData.created_at).toLocaleString() : "—"}</span></div>
          </div>
        ) : <div className="text-xs text-zinc-500">Loading...</div>}
      </motion.div>

      {/* All businesses */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Your businesses — {allBizs.length}</div>
          <span className="text-xs text-zinc-500">100 credits per extra business</span>
        </div>
        <div className="mt-3 space-y-2">
          {allBizs.map((b) => (
            <div key={b.id} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${selected === b.id ? "border-black bg-black text-white" : "border-zinc-200 bg-white"}`}>
              <div>
                <div className="font-medium">{b.name}</div>
                <div className={`font-mono text-[11px] ${selected === b.id ? "text-zinc-300" : "text-zinc-500"}`}>ID: {b.id}</div>
                <div className={`${selected === b.id ? "text-zinc-300" : "text-zinc-500"}`}>{b.domain || "no domain"} • {new Date(b.created_at).toLocaleDateString()}</div>
              </div>
              <button onClick={() => setSelected(b.id)} className={`rounded-full px-3 py-1 text-xs ${selected === b.id ? "bg-white text-black" : "bg-black text-white"}`}>{selected === b.id ? "Selected" : "Select"}</button>
            </div>
          ))}
          {allBizs.length === 0 && <div className="text-xs text-zinc-500">No businesses yet — create one below.</div>}
        </div>
      </motion.div>

      {/* Current business + API keys */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold">Current business — API access</div>
        {biz ? (
          <>
            <div className="mt-3 rounded-xl bg-zinc-50 p-3 text-xs space-y-1">
              <div><span className="text-zinc-500">Name:</span> {biz.name}</div>
              <div><span className="text-zinc-500">ID:</span> <span className="font-mono text-[11px]">{biz.id}</span></div>
              <div><span className="text-zinc-500">Domain:</span> {biz.domain || "—"}</div>
              <div><span className="text-zinc-500">Created:</span> {new Date(biz.created_at).toLocaleString()}</div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold">API keys (prefix shown, full key only once)</div>
                <button onClick={regen} className="rounded-full border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50">Regenerate key</button>
              </div>
              {loadingKeys ? <div className="text-xs text-zinc-500 mt-2">Loading...</div> : (
                <div className="mt-2 space-y-1">
                  {keys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between rounded-xl border border-zinc-100 px-3 py-2 text-xs">
                      <span className="font-mono">{k.prefix}••••••••••••</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${k.is_active ? "bg-green-100 text-green-800" : "bg-zinc-100"}`}>{k.is_active ? "active" : "revoked"}</span>
                      <span className="font-mono text-[11px]">{k.id.slice(0, 8)}</span>
                      <span className="text-zinc-500">{new Date(k.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                  {keys.length === 0 && <div className="text-xs text-zinc-500">No keys yet.</div>}
                </div>
              )}
              {apiKey && <div className="mt-3 break-all rounded-xl bg-zinc-950 p-3 font-mono text-xs text-lime-300">{apiKey} <span className="text-zinc-500">— copy now, won't show again</span></div>}
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Base URL: <code className="font-mono">https://repllyer.vercel.app</code> — send <code>x-api-key: rply_live_...</code> header. No email required for session — bot will ask or treat as guest.</div>
            </div>
            <form onSubmit={updateBiz} className="mt-4 grid gap-2">
              <input placeholder="New name" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
              <input placeholder="Webhook URL (optional)" value={form.webhook_url} onChange={(e)=>setForm({...form, webhook_url: e.target.value})} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
              <textarea placeholder="Description" value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} rows={2} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
              <button className="rounded-full bg-black px-4 py-2 text-xs text-white">Save changes</button>
            </form>
          </>
        ) : <div className="text-xs text-zinc-500">Select a business above.</div>}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold">Create new business <span className="text-xs font-normal text-zinc-500">— 100 credits after first</span></div>
        <form onSubmit={createBiz} className="mt-3 space-y-2">
          <input placeholder="Name" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input placeholder="Domain" value={form.domain} onChange={(e)=>setForm({...form, domain: e.target.value})} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <textarea placeholder="What do you sell? (knowledge prompt)" value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} rows={3} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <button className="w-full rounded-full bg-black py-2 text-xs font-medium text-white">Create (+100 credits if not first)</button>
        </form>
        {msg && <p className="mt-2 text-xs text-zinc-600">{msg}</p>}
      </motion.div>
    </div>
  );
}
