// Root layout - applies DM Sans + JetBrains Mono fonts and global styles.
// Font: geometric precision pairing (DM Sans for heading/body, JetBrains Mono for code).

import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Pokedex PLM",
  description:
    "Manage product requirements, test procedures, and test cases through conversation.",
  openGraph: {
    title: "Pokedex PLM",
    description:
      "Chat-based product lifecycle management. Manage requirements, test procedures, and test cases through conversation instead of clicking through menus.",
    url: "https://pokedex-plm.vercel.app",
    siteName: "Pokedex PLM",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pokedex PLM",
    description:
      "Chat-based product lifecycle management. Manage requirements, test procedures, and test cases through conversation instead of clicking through menus.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="font-body">{children}</body>
    </html>
  );
}
