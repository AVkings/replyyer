"use client";
import { useEffect, useState } from "react";
import { useBiz } from "@/components/dashboard/BizContext";
import { createBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";

type SessionRow = { id: string; created_at: string; status: string; end_user_id: string; end_users: { name: string; email: string } | null };

export default function Chats() {
  const { selected } = useBiz();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [name, setName] = useState("Test User");
  const [email, setEmail] = useState("test@example.com");
  const [session, setSession] = useState("");
  const [msg, setMsg] = useState("refund not received?");
  const [out, setOut] = useState("");

  useEffect(() => {
    if (!selected) return;
    const supa = createBrowserClient();
    const load = async () => {
      const { data } = await supa.from("sessions").select("id, created_at, status, end_user_id, end_users(name,email)").eq("business_id", selected).order("created_at", { ascending: false }).limit(30);
      setSessions((data as unknown as SessionRow[]) || []);
    };
    load();
  }, [selected]);

  async function init() {
    const r = await fetch("/api/v1/session/init", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey }, body: JSON.stringify({ name, email }) });
    const j = await r.json();
    setOut(JSON.stringify(j, null, 2));
    if (j.session_id) setSession(j.session_id);
  }
  async function chat() {
    const r = await fetch("/api/v1/chat", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey }, body: JSON.stringify({ session_id: session, message: msg }) });
    const j = await r.json();
    setOut(JSON.stringify(j, null, 2));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">CRM — Chats & AI transcripts</h1>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 text-left text-zinc-500"><tr><th className="px-4 py-2">Visitor</th><th>Email</th><th>Status</th><th>Session</th><th>When</th></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-2">{s.end_users?.name || s.end_user_id.slice(0, 8)}</td>
                <td className="font-mono text-[11px]">{s.end_users?.email || "—"}</td>
                <td><span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px]">{s.status}</span></td>
                <td><Link href={`/dashboard/chats/${s.id}`} className="font-mono text-[11px] underline">{s.id.slice(0, 8)} →</Link></td>
                <td>{new Date(s.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {sessions.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-zinc-500">No sessions yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-950 p-5 text-white">
        <div className="text-sm font-semibold">Playground — no curl needed</div>
        <div className="mt-3 grid gap-2">
          <input value={apiKey} onChange={(e)=>setApiKey(e.target.value)} placeholder="rply_live_..." className="rounded-xl bg-zinc-900 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="name (optional — bot will ask if missing)" className="rounded-xl bg-zinc-900 px-3 py-2 text-sm" />
            <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="email (optional)" className="rounded-xl bg-zinc-900 px-3 py-2 text-sm" />
          </div>
          <button onClick={init} className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black">1. Init session</button>
          <input value={session} onChange={(e)=>setSession(e.target.value)} placeholder="session_id" className="rounded-xl bg-zinc-900 px-3 py-2 font-mono text-xs" />
          <textarea value={msg} onChange={(e)=>setMsg(e.target.value)} rows={2} className="rounded-xl bg-zinc-900 px-3 py-2 text-sm" />
          <button onClick={chat} className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black">2. Send chat</button>
          <pre className="overflow-auto rounded-xl bg-black p-3 text-xs text-lime-300">{out || "output..."}</pre>
        </div>
      </div>
    </div>
  );
}
