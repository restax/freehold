import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono, Outfit } from "next/font/google";
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
    "Fair-source AI transaction management and CRM for real estate brokerages and transaction coordinators.",
  openGraph: {
    title: "Freehold",
    description:
      "AI reads the purchase contract, you approve every value, and every deadline lands in one system. Fair source, free to self-host.",
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
      </body>
    </html>
  );
}
