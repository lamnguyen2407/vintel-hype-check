import type { Metadata } from "next";
import { Orbitron, Tomorrow } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const tomorrow = Tomorrow({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
});

const orbitron = Orbitron({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Hype Check — Vintelligence AI Challenge",
  description: "A three-round AI knowledge and hype battle for Vintelligence Club Fair.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${tomorrow.variable} ${orbitron.variable}`}>
      <body>{children}</body>
    </html>
  );
}
