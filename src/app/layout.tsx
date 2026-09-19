import type { Metadata } from "next";
import { Be_Vietnam_Pro, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Hype Check — Vintelligence Club Fair",
  description: "A two-player AI-scored pitch battle for Vintelligence Club Fair.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${beVietnamPro.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
