import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://freeholdtc.dev"),
  title: "Freehold",
  description:
    "Open-source AI transaction management and CRM for real estate brokerages and transaction coordinators.",
  openGraph: {
    title: "Freehold",
    description:
      "AI reads the purchase contract, you approve every value, and every deadline lands in one system. Open source.",
    url: "https://freeholdtc.dev",
    siteName: "Freehold",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
