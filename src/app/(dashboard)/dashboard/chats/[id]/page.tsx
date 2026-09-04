"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

type Msg = { id: string; role: string; content: string; created_at: string };

export default function ChatDetail() {
  const { id } = useParams<{ id: string }>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [meta, setMeta] = useState<{ name: string; email: string } | null>(null);

  const load = async () => {
    const supa = createBrowserClient();
    const { data: sess } = await supa.from("sessions").select("id, end_users(name,email)").eq("id", id).single();
    setMeta((sess as unknown as { end_users: { name: string; email: string } })?.end_users || null);
    const { data } = await supa.from("messages").select("id, role, content, created_at").eq("session_id", id).order("created_at", { ascending: true });
    setMsgs((data as Msg[]) || []);
  };
  useEffect(() => { load(); }, [id]);

  async function sendHuman() {
    if (!reply.trim()) return;
    const supa = createBrowserClient();
    // need business_id for FK
    const { data: sess } = await supa.from("sessions").select("business_id").eq("id", id).single();
    await supa.from("messages").insert({ session_id: id, business_id: (sess as { business_id: string })?.business_id, role: "human", content: reply });
    setReply("");
    load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold">Chat — {id.slice(0, 8)}</h1>
      {meta && <div className="text-xs text-zinc-500">Visitor: <span className="font-medium text-black">{meta.name}</span> • {meta.email}</div>}

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
        {msgs.length === 0 && <div className="text-xs text-zinc-500">No messages.</div>}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "bg-black text-white" : m.role === "human" ? "bg-blue-600 text-white" : "bg-zinc-100 text-black"}`}>
              <div className="text-[11px] opacity-60">{m.role} • {new Date(m.created_at).toLocaleTimeString()}</div>
              <div className="mt-1 whitespace-pre-wrap">{m.content}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input value={reply} onChange={(e)=>setReply(e.target.value)} placeholder="Reply as human (takes over)..." className="flex-1 rounded-full border border-zinc-200 px-4 py-2 text-sm" />
        <button onClick={sendHuman} className="rounded-full bg-black px-6 py-2 text-sm text-white">Send</button>
      </div>
      <p className="text-xs text-zinc-500">Human messages are stored with role=human. Your bot can poll messages for session to show takeover.</p>
    </div>
  );
}
