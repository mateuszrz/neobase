import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";
import { Nav, Footer } from "@/components/ui";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-roobert",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://neobase.co"),
  title: {
    default: "NeoBase — Global Neobank & Fintech Intelligence",
    template: "%s — NeoBase",
  },
  description:
    "Track ratings, reviews and sentiment for 100+ neobanks and crypto exchanges worldwide. Independent fintech intelligence.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable}`}>
      <body>
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
