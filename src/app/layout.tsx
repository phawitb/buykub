import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { BRAND_NAME, BRAND_ORIGIN } from "@/lib/brand";
import "./globals.css";

const thaiSans = IBM_Plex_Sans_Thai({
  variable: "--font-thai-sans",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(BRAND_ORIGIN),
  title: `${BRAND_NAME} — แปะลิงก์ ขายได้เลย`,
  description: "ร้านค้าออนไลน์ในลิงก์เดียว สำหรับครีเอเตอร์ไทย",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${thaiSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
