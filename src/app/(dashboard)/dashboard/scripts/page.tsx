"use client";
import { useEffect, useState } from "react";
import { useBiz } from "@/components/dashboard/BizContext";
import { motion } from "framer-motion";

type Script = {
  id: string;
  name: string;
  slug: string;
  description: string;
  trigger_keywords: string;
  required_params: string[];
  action_type: "code" | "webhook";
  action_config: Record<string, unknown>;
  env_keys?: string[];
  gmail_app_password_set?: boolean;
  is_active: boolean;
  created_at: string;
};

const PARAM_OPTIONS = ["email", "phone", "name", "order_id", "username", "account_id"];

const CODE_TEMPLATE = `// Variables: params (params.email, params.phone...), contact ({name,email,phone}),
// business ({id, name}), script ({slug, name}), env (YOUR OWN variables below)
// Helpers: sendEmail(to, subject, body), log(...)
// Set: result = {...} to return data.
// Secrets: never hardcode passwords here — put them in Variables,
// read via env.YOUR_KEY. Gmail? add GMAIL_USER + GMAIL_APP_PASSWORD below.

if (!params.email) throw new Error("email required");

sendEmail(
  params.email,
  "Reset your password",
  "Hi " + (contact.name || "there") + ",\\n\\nClick here to reset your password. Link expires in 30 minutes."
);

result = { emailed: params.email, action: "password-reset-sent" };`;

type EnvRow = { key: string; value: string };

function EnvEditor({ rows, setRows }: { rows: EnvRow[]; setRows: (r: EnvRow[]) => void }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">Your variables — stored inside this script only (API keys, SMTP passwords, anything). Code reads them as <code className="font-mono">env.KEY</code>. Values are never shown again after saving.</div>
      <div className="mt-2 space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={r.key}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") } : x)))}
              placeholder="KEY (e.g. GMAIL_APP_PASSWORD)"
              className="w-1/2 rounded-xl border border-zinc-200 px-3 py-1.5 font-mono text-xs"
            />
            <input
              value={r.value}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
              type="password"
              placeholder={r.key ? "value (empty = keep saved)" : "value"}
              className="w-1/2 rounded-xl border border-zinc-200 px-3 py-1.5 font-mono text-xs"
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="rounded-full border border-zinc-200 px-3 text-xs">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setRows([...rows, { key: "", value: "" }])} className="rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs">+ add variable</button>
      </div>
    </div>
  );
}

export default function Scripts() {
  const { selected } = useBiz();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", trigger_keywords: "", required_params: ["email"],
    action_type: "code" as Script["action_type"],
    webhook_url: "", code: CODE_TEMPLATE,
  });
  const [envRows, setEnvRows] = useState<EnvRow[]>([{ key: "GMAIL_USER", value: "" }, { key: "GMAIL_APP_PASSWORD", value: "" }]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editEnv, setEditEnv] = useState<EnvRow[]>([]);
  const [editRemove, setEditRemove] = useState<string[]>([]);
  const [editNewKey, setEditNewKey] = useState("");
  const [editNewVal, setEditNewVal] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!selected) return;
    const r = await fetch(`/api/scripts?business_id=${selected}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok) setScripts(j.scripts || []);
  };
  useEffect(() => { load(); }, [selected]);

  const toggleParam = (p: string) => {
    setForm((f) => ({ ...f, required_params: f.required_params.includes(p) ? f.required_params.filter((x) => x !== p) : [...f.required_params, p] }));
  };

  function envObject(rows: EnvRow[]) {
    const o: Record<string, string> = {};
    for (const r of rows) if (r.key.trim() && r.value) o[r.key.trim()] = r.value;
    return o;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return setMsg("Select a business first.");
    if (!form.name.trim()) return setMsg("Script name required (e.g. Forgot password).");
    setBusy(true);
    setMsg("");
    try {
      const action_config: Record<string, unknown> =
        form.action_type === "webhook"
          ? { url: form.webhook_url.trim(), method: "POST" }
          : { code: form.code, language: "javascript", env: envObject(envRows) };
      const r = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: selected,
          name: form.name.trim(),
          description: form.description.trim() || `Runs when visitor asks: ${form.trigger_keywords.trim()}`,
          trigger_keywords: form.trigger_keywords.trim(),
          required_params: form.required_params,
          action_type: form.action_type,
          action_config,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "create failed");
      setMsg(`Script "${j.script.name}" created. AI will run it for 30 credits when info is verified.`);
      setForm({ name: "", description: "", trigger_keywords: "", required_params: ["email"], action_type: "code", webhook_url: "", code: CODE_TEMPLATE });
      setEnvRows([{ key: "GMAIL_USER", value: "" }, { key: "GMAIL_APP_PASSWORD", value: "" }]);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "create failed");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(s: Script) {
    setEditing(s.id);
    setEditCode(String(s.action_config.code || ""));
    setEditEnv((s.env_keys || []).map((k) => ({ key: k, value: "" })));
    setEditRemove([]);
    setEditNewKey("");
    setEditNewVal("");
    setMsg("");
  }

  async function saveEdit(s: Script) {
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch(`/api/scripts/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: selected,
          action_config: { code: editCode, language: "javascript", env: envObject(editEnv), env_remove: editRemove },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "save failed");
      setMsg("Script updated. Empty values kept the saved secrets.");
      setEditing(null);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  function removeEditKey(k: string) {
    setEditEnv(editEnv.filter((r) => r.key !== k));
    setEditRemove([...editRemove, k]);
  }

  async function toggleActive(s: Script) {
    const r = await fetch(`/api/scripts/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: selected, is_active: !s.is_active }) });
    if (r.ok) load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this script?")) return;
    const r = await fetch(`/api/scripts/${id}?business_id=${selected}`, { method: "DELETE" });
    if (r.ok) load();
  }

  if (!selected) return <div className="text-sm text-zinc-500">Select a business in Settings.</div>;

  return (
    <div className="space-y-5">
      <div>
        <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-lg font-semibold">Action scripts — playground</motion.h1>
        <p className="text-xs text-zinc-500">Write real JavaScript with client variables + your own secrets below. AI verifies info, then runs it for <b>30 credits</b>. E.g. “forgot password → send reset email”.</p>
      </div>

      <motion.form onSubmit={create} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
        <div className="text-sm font-semibold">New script</div>
        <div className="grid gap-2 md:grid-cols-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name (e.g. Forgot password)" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-black" />
          <input value={form.trigger_keywords} onChange={(e) => setForm({ ...form, trigger_keywords: e.target.value })} placeholder="Triggers (e.g. forgot password, reset, can't login)" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-black" />
        </div>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="When should AI run this? (e.g. visitor forgot password and gave registered email)" rows={2} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-black" />
        <div>
          <div className="text-xs text-zinc-500">Required info (AI must collect before running)</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {PARAM_OPTIONS.map((p) => (
              <button key={p} type="button" onClick={() => toggleParam(p)} className={`rounded-full border px-3 py-1 font-mono text-xs ${form.required_params.includes(p) ? "bg-black text-white border-black" : "border-zinc-200"}`}>{p}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {(["code", "webhook"] as const).map((a) => (
            <button key={a} type="button" onClick={() => setForm({ ...form, action_type: a })} className={`rounded-xl border px-3 py-2 text-xs font-mono ${form.action_type === a ? "bg-black text-white border-black" : "border-zinc-200"}`}>{a === "code" ? "code — javascript" : "webhook"}</button>
          ))}
        </div>
        {form.action_type === "webhook" && (
          <input value={form.webhook_url} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })} placeholder="https://your-server.com/reset-password" className="w-full rounded-xl border border-zinc-200 px-3 py-2 font-mono text-sm" />
        )}
        {form.action_type === "code" && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-zinc-500">JavaScript — <code className="font-mono">params.*</code>, <code className="font-mono">contact.*</code>, <code className="font-mono">env.*</code>, <code className="font-mono">sendEmail()</code> → <code className="font-mono">result = {"{...}"}</code></div>
                <button type="button" onClick={() => setForm({ ...form, code: CODE_TEMPLATE })} className="text-[11px] underline shrink-0">Reset template</button>
              </div>
              <textarea value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} rows={12} spellCheck={false} className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-5 text-lime-300 outline-none focus:border-black" placeholder="// your code here — secrets go in Variables below, never here" />
              <div className="mt-1 text-[11px] text-zinc-500">{form.code.length}/10000 chars • sandboxed • 30 credits per run • Python not supported on serverless — JS covers the same logic</div>
            </div>
            <EnvEditor rows={envRows} setRows={setEnvRows} />
          </div>
        )}
        <motion.button whileTap={{ scale: 0.98 }} disabled={busy} className="rounded-full bg-black px-5 py-2 text-xs font-medium text-white disabled:opacity-50">{busy ? "Creating…" : "Create script"}</motion.button>
      </motion.form>

      {msg && <div className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs">{msg}</div>}

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold">Your scripts — {scripts.length}</div>
        <div className="mt-3 space-y-2">
          {scripts.length === 0 && <div className="text-xs text-zinc-500">None yet. Create “Forgot password” above to test.</div>}
          {scripts.map((s) => (
            <div key={s.id} className="rounded-xl border border-zinc-100 p-3">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div>
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="ml-2 font-mono text-[11px] text-zinc-500">{s.slug}</span>
                  <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[11px]">{s.action_type}</span>
                  {(s.env_keys || []).map((k) => (
                    <span key={k} className="ml-1 rounded-full bg-green-100 px-2 py-0.5 font-mono text-[11px] text-green-800">🔑{k}</span>
                  ))}
                  {s.gmail_app_password_set && <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-800">gmail saved</span>}
                </div>
                <div className="flex gap-2">
                  {s.action_type === "code" && (
                    <button onClick={() => (editing === s.id ? setEditing(null) : startEdit(s))} className="rounded-full border border-zinc-200 px-3 py-1 text-[11px]">Edit</button>
                  )}
                  <button onClick={() => toggleActive(s)} className={`rounded-full px-3 py-1 text-[11px] ${s.is_active ? "bg-green-100 text-green-800" : "bg-zinc-100"}`}>{s.is_active ? "active" : "paused"}</button>
                  <button onClick={() => remove(s.id)} className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] hover:border-red-400 hover:text-red-600">Delete</button>
                </div>
              </div>
              <div className="mt-1 text-xs text-zinc-600">{s.description}</div>
              <div className="mt-1 font-mono text-[11px] text-zinc-500">needs [{s.required_params.join(", ")}] • triggers: {s.trigger_keywords || "—"}</div>
              {editing === s.id && s.action_type === "code" && (
                <div className="mt-3 space-y-2 rounded-xl bg-zinc-50 p-3">
                  <textarea value={editCode} onChange={(e) => setEditCode(e.target.value)} rows={10} spellCheck={false} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-5 text-lime-300" />
                  <div className="text-xs text-zinc-500">Saved variables ({(s.env_keys || []).length}) — empty value keeps the saved secret, ✕ deletes it:</div>
                  {editEnv.map((r, i) => (
                    <div key={r.key} className="flex gap-2">
                      <input value={r.key} disabled className="w-1/2 rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-1.5 font-mono text-xs" />
                      <input value={r.value} onChange={(e) => setEditEnv(editEnv.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} type="password" placeholder="empty = keep saved" className="w-1/2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs" autoComplete="new-password" />
                      <button type="button" onClick={() => removeEditKey(r.key)} className="rounded-full border border-zinc-200 bg-white px-3 text-xs">✕</button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input value={editNewKey} onChange={(e) => setEditNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))} placeholder="NEW_KEY" className="w-1/3 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs" />
                    <input value={editNewVal} onChange={(e) => setEditNewVal(e.target.value)} type="password" placeholder="value" className="w-1/3 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs" autoComplete="new-password" />
                    <button onClick={() => { if (editNewKey.trim() && editNewVal) { setEditEnv([...editEnv, { key: editNewKey.trim(), value: editNewVal }]); setEditNewKey(""); setEditNewVal(""); } }} className="rounded-full border border-dashed border-zinc-300 bg-white px-3 py-1.5 text-[11px]">+ add</button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(s)} disabled={saving} className="rounded-full bg-black px-4 py-1.5 text-[11px] text-white disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
                    <button onClick={() => setEditing(null)} className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-[11px]">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
