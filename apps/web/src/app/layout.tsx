import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Freehold",
  description:
    "Open-source AI transaction management and CRM for real estate brokerages and transaction coordinators.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
