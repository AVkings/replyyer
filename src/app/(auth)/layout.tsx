import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in or create your account",
  description: "Log in to Repllyer with Google and get your AI customer-care API key.",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-60" aria-hidden="true" />
      <div className="animate-floaty absolute -top-20 left-1/2 h-56 w-[36rem] -translate-x-1/2 rounded-full bg-zinc-200/70 blur-3xl" aria-hidden="true" />
      <div className="relative">{children}</div>
    </div>
  );
}
