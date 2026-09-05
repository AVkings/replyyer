import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE = "https://repllyer.vercel.app";
const TITLE = "Repllyer — AI Customer Care That Actually Helps";
const DESCRIPTION =
  "Repllyer is an API-first AI customer-care bot with human takeover, priority sorting, topic categorization, and action scripts. Start free with 180 messages.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: TITLE,
    template: "%s | Repllyer",
  },
  description: DESCRIPTION,
  keywords: [
    "AI customer support",
    "customer care chatbot",
    "support chatbot API",
    "AI support bot with human handoff",
    "customer support automation",
    "ticket priority sorting",
    "Razorpay credits chatbot",
    "AI action scripts",
  ],
  authors: [{ name: "Repllyer" }],
  creator: "Repllyer",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE,
    siteName: "Repllyer",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Repllyer — AI customer care" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Repllyer",
      url: SITE,
      description: DESCRIPTION,
    },
    {
      "@type": "WebSite",
      name: "Repllyer",
      url: SITE,
    },
    {
      "@type": "SoftwareApplication",
      name: "Repllyer",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE,
      description: DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR", description: "180 free messages" },
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
