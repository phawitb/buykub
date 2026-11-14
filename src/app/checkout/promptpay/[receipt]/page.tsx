import type { Metadata } from "next";
import { PromptpayCheckout } from "./PromptpayCheckout";
export const metadata: Metadata = { title: "ชำระด้วย PromptPay | BUYKUB", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function PromptpayPage({ params }: { params: Promise<{ receipt: string }> }) {
  const { receipt } = await params;
  return <PromptpayCheckout receipt={receipt} />;
}
