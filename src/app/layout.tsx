import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { Suspense } from "react";
import { MetaPixel } from "@/components/MetaPixel";
import { BRAND_NAME, BRAND_ORIGIN } from "@/lib/brand";
import "./globals.css";

const thaiSans = Noto_Sans_Thai({
  variable: "--font-thai-sans",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(BRAND_ORIGIN),
  title: `${BRAND_NAME} — ลงสินค้าแล้ว รอรับเงินได้เลย`,
  description:
    "ขายไฟล์ คีย์สินค้า และคอร์สออนไลน์ ระบบยืนยันเงินเข้า ส่งของ และเปิดสิทธิ์ให้ลูกค้าเองทุกออเดอร์",
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
      <body className="min-h-full flex flex-col bg-background text-ink">
        {children}
        {/* Reads the URL, so it waits for the client instead of making every page dynamic. */}
        <Suspense fallback={null}><MetaPixel /></Suspense>
      </body>
    </html>
  );
}
