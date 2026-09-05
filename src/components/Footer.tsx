import Link from "next/link";

const cols = [
  {
    h: "Product",
    links: [
      { label: "Pricing", href: "/#pricing" },
      { label: "Action scripts", href: "/#scripts" },
      { label: "How it works", href: "/#how" },
      { label: "FAQ", href: "/#faq" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    h: "Developers",
    links: [
      { label: "API docs", href: "/docs" },
      { label: "Sessions API", href: "/docs#session" },
      { label: "Chat API", href: "/docs#chat" },
      { label: "Billing & credits", href: "/docs#billing" },
      { label: "Onboarding", href: "/onboarding" },
    ],
  },
  {
    h: "Company",
    links: [
      { label: "Get API key", href: "/signup" },
      { label: "Log in", href: "/login" },
      { label: "Start free", href: "/signup" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-black text-sm font-bold text-white">R</span>
            <span className="text-sm font-semibold tracking-tight">repllyer</span>
            <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-medium tracking-widest text-zinc-500">BETA</span>
          </Link>
          <p className="mt-3 max-w-xs text-xs leading-5 text-zinc-500">
            API-first AI customer care with human takeover, priority sorting, and action scripts. 180 messages free.
          </p>
        </div>
        {cols.map((c) => (
          <nav key={c.h} aria-label={c.h}>
            <div className="text-xs font-semibold tracking-widest text-zinc-400">{c.h.toUpperCase()}</div>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.label + l.href}>
                  <Link href={l.href} className="text-sm text-zinc-600 transition hover:text-black">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-zinc-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-zinc-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Repllyer — Secure • Fast • Reliable</span>
          <span className="font-mono text-[11px]"> repllyer.vercel.app</span>
        </div>
      </div>
    </footer>
  );
}
