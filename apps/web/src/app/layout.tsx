import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono, Outfit } from "next/font/google";
import Script from "next/script";
import { SiteAnalytics } from "@/components/site-analytics";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz"] });
const display = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://freeholdtc.dev"),
  title: "Freehold",
  description:
    "AI transaction management and CRM for real estate brokerages and transaction coordinators. Free to self-host, easy on Freehold Cloud.",
  openGraph: {
    title: "Freehold",
    description: "A complete system to run a transaction coordination business. Free to self-host.",
    url: "https://freeholdtc.dev",
    siteName: "Freehold",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${display.variable} ${mono.variable}`}
    >
      <body>
        {children}
        <SiteAnalytics />
        <Script
          id="opinly-pixel"
          strategy="afterInteractive"
          src="https://static.opinly.ai/p.js"
          data-key="pk-lGtesMaJSHkg1r9ZikgGsgcsrDGWBbCoQVpkIlz"
        />
      </body>
    </html>
  );
}
