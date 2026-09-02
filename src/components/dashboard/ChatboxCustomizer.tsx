"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Sparkles, Eye } from "lucide-react";

type Config = {
  primaryColor: string;
  headerTitle: string;
  headerSubtitle: string;
  welcomeMessage: string;
  position: "bottom-right" | "bottom-left";
  borderRadius: string;
};

const defaults: Config = {
  primaryColor: "#ffffff",
  headerTitle: "Repllyer Support",
  headerSubtitle: "AI • Replies instantly",
  welcomeMessage: "Hi! I'm your AI assistant. How can I help?",
  position: "bottom-right",
  borderRadius: "24px",
};

export default function ChatboxCustomizer({ orgId, apiKey, initialConfig }: { orgId: string; apiKey: string; initialConfig?: Config | null }) {
  const [config, setConfig] = useState<Config>({ ...defaults, ...initialConfig });
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/chatbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: orgId, config }),
    });
    const j = await res.json();
    setSaving(false);
    if (j.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const embedLink = `https://replyyer.vercel.app/embed/${orgId}`;
  const iframeCode = `<iframe src="${embedLink}?api_key=${apiKey}" width="400" height="560" style="border:0;border-radius:${config.borderRadius};overflow:hidden" allow="clipboard-read; clipboard-write"></iframe>`;
  const scriptCode = `<script src="https://replyyer.vercel.app/widget.js" data-org="${orgId}" data-api-key="${apiKey}" data-title="${config.headerTitle}" async><\/script>`;

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-[20px] border border-neutral-800 bg-neutral-950 p-6">
          <h3 className="text-sm font-semibold">Customize</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-neutral-500">Primary Color</label>
              <div className="mt-2 flex gap-2">
                {["#ffffff", "#22c55e", "#3b82f6", "#ef4444", "#a855f7", "#000000"].map((c) => (
                  <button key={c} onClick={() => setConfig({ ...config, primaryColor: c })} className="h-8 w-8 rounded-full border border-neutral-800" style={{ background: c }} />
                ))}
                <input type="color" value={config.primaryColor} onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })} className="h-8 w-8 rounded-full" />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-neutral-500">Header Title</label>
              <input value={config.headerTitle} onChange={(e) => setConfig({ ...config, headerTitle: e.target.value })} className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-neutral-500">Subtitle</label>
              <input value={config.headerSubtitle} onChange={(e) => setConfig({ ...config, headerSubtitle: e.target.value })} className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-neutral-500">Welcome Message</label>
              <textarea value={config.welcomeMessage} onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-neutral-500">Position</label>
                <select value={config.position} onChange={(e) => setConfig({ ...config, position: e.target.value as Config["position"] })} className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white">
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-neutral-500">Radius</label>
                <select value={config.borderRadius} onChange={(e) => setConfig({ ...config, borderRadius: e.target.value })} className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white">
                  <option value="12px">12px</option>
                  <option value="16px">16px</option>
                  <option value="24px">24px</option>
                  <option value="28px">28px</option>
                </select>
              </div>
            </div>
            <button onClick={save} disabled={saving} className="w-full rounded-xl bg-white py-2.5 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50">
              {saving ? "Saving..." : saved ? "Saved ✓" : "Save & Generate Code"}
            </button>
          </div>
        </div>

        <div className="rounded-[20px] border border-neutral-800 bg-black p-4">
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">Link</p>
          <div className="mt-2 flex gap-2">
            <code className="flex-1 truncate rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white">{embedLink}</code>
            <button onClick={() => copy(embedLink, "link")} className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-black">{copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
          </div>
          <p className="mt-3 text-xs font-medium uppercase tracking-widest text-neutral-500">Iframe (copy to site)</p>
          <pre className="mt-1 overflow-auto rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-300">{iframeCode}</pre>
          <button onClick={() => copy(iframeCode, "iframe")} className="mt-2 w-full rounded-xl border border-neutral-800 bg-black py-2 text-xs text-white hover:bg-neutral-900">{copied === "iframe" ? "Copied!" : "Copy Iframe"}</button>
          <p className="mt-3 text-xs font-medium uppercase tracking-widest text-neutral-500">Script (auto-injects)</p>
          <pre className="mt-1 overflow-auto rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-300">{scriptCode}</pre>
          <button onClick={() => copy(scriptCode, "script")} className="mt-2 w-full rounded-xl bg-white py-2 text-xs font-medium text-black hover:bg-neutral-200">{copied === "script" ? "Copied!" : "Copy Script"}</button>
        </div>
      </div>

      <div className="rounded-[20px] border border-neutral-800 bg-neutral-950 p-6">
        <p className="flex items-center gap-2 text-sm font-semibold"><Eye className="h-4 w-4" /> Live Preview</p>
        <p className="text-xs text-neutral-500">Updates as you customize. This is what customers see.</p>
        <div className="mt-4 flex h-[520px] items-center justify-center rounded-[20px] border border-dashed border-neutral-700 bg-black p-4">
          <div className="flex w-[320px] flex-col overflow-hidden rounded-[28px] border border-neutral-800 bg-black shadow-xl" style={{ borderRadius: config.borderRadius }}>
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: config.primaryColor, color: config.primaryColor === "#ffffff" || config.primaryColor === "#22c55e" ? "#000" : "#fff" }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/10"><Sparkles className="h-4 w-4" /></div>
              <div>
                <div className="text-sm font-semibold leading-none">{config.headerTitle}</div>
                <div className="text-xs opacity-70">{config.headerSubtitle}</div>
              </div>
            </div>
            <div className="flex-1 bg-black p-3">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white">{config.welcomeMessage}</div>
              <div className="mt-2 rounded-2xl bg-white px-3 py-2 text-xs text-black self-end">Hello, I need help with login</div>
            </div>
            <div className="border-t border-neutral-800 bg-black p-2">
              <div className="flex gap-2">
                <div className="flex-1 rounded-full border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-500">Ask anything…</div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: config.primaryColor === "#ffffff" ? "#000" : config.primaryColor }}>➤</div>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-neutral-600">Position: {config.position} • Paste the iframe/script in your site's `&lt;body&gt;` and it just works.</p>
      </div>
    </div>
  );
}
