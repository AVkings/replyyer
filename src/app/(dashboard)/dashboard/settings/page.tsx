"use client";
import { useState } from "react";
import { useBiz } from "@/components/dashboard/BizContext";
import { createBrowserClient } from "@/lib/supabase-browser";

export default function Settings() {
  const { selected, bizs, refresh } = useBiz();
  const biz = bizs.find((b) => b.id === selected);
  const [form, setForm] = useState({ name: "", domain: "", description: "", webhook_url: "" });
  const [apiKey, setApiKey] = useState("");
  const [msg, setMsg] = useState("");

  async function createBiz(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/businesses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await r.json();
    if (r.ok) { setApiKey(j.api_key); setMsg("Created — save API key now"); refresh(); }
    else setMsg(j.error || "error");
  }

  async function regen() {
    const r = await fetch(`/api/businesses/${selected}/api-key`, { method: "POST" });
    const j = await r.json();
    if (r.ok) setApiKey(j.api_key);
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
      <h1 className="text-lg font-semibold">Settings</h1>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold">Current business</div>
        {biz ? (
          <div className="mt-2 text-xs space-y-1">
            <div><span className="text-zinc-500">Name:</span> {biz.name}</div>
            <div><span className="text-zinc-500">Domain:</span> {biz.domain || "—"}</div>
            <div><span className="text-zinc-500">ID:</span> <span className="font-mono">{biz.id}</span></div>
            <button onClick={regen} className="mt-3 rounded-full border border-zinc-200 px-3 py-1.5 text-xs">Regenerate API key</button>
            {apiKey && <div className="mt-2 break-all rounded-xl bg-zinc-950 p-3 font-mono text-xs text-lime-300">{apiKey}</div>}
          </div>
        ) : <div className="text-xs text-zinc-500">Select a business</div>}
        <form onSubmit={updateBiz} className="mt-4 grid gap-2">
          <input placeholder="New name" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input placeholder="Webhook URL (optional)" value={form.webhook_url} onChange={(e)=>setForm({...form, webhook_url: e.target.value})} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <textarea placeholder="Description" value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} rows={2} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <button className="rounded-full bg-black px-4 py-2 text-xs text-white">Save changes</button>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold">Create new business</div>
        <form onSubmit={createBiz} className="mt-3 space-y-2">
          <input placeholder="Name" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input placeholder="Domain" value={form.domain} onChange={(e)=>setForm({...form, domain: e.target.value})} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <textarea placeholder="What do you sell? (KB prompt)" value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} rows={3} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <button className="w-full rounded-full bg-black py-2 text-xs font-medium text-white">Create + get API key</button>
        </form>
        {msg && <p className="mt-2 text-xs text-zinc-600">{msg}</p>}
      </div>
    </div>
  );
}
