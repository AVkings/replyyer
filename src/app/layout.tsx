import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Repllyer — AI Customer Care that actually helps",
  description: "API-first AI support bot with human takeover, priority sorting, topic categorization. 180 msgs free.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white">
        <Navbar />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-zinc-200 py-8 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} Repllyer — Secure • Fast • Reliable
        </footer>
      </body>
    </html>
  );
}
