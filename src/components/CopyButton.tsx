"use client";
import { useState } from "react";

export function CopyButton({ text, dark = false }: { text: string; dark?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy code to clipboard"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1600);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className={`rounded-full px-3 py-1 font-mono text-[11px] transition ${
        dark
          ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
          : "border border-zinc-200 bg-white text-zinc-600 hover:border-black hover:text-black"
      }`}
    >
      {ok ? "Copied ✓" : "Copy"}
    </button>
  );
}
