import { isReceiptId } from "@/lib/payments/receipt";
import Link from "next/link";
import { CheckoutSuccess } from "./CheckoutSuccess";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams;
  if (!isReceiptId(sessionId)) {
    return <main className="mx-auto flex min-h-screen max-w-lg items-center px-5"><p className="text-sm text-red-600">ไม่พบข้อมูลการชำระเงิน</p></main>;
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-5">
      <section className="w-full rounded-3xl border border-line bg-paper p-8 text-center shadow-lift-1">
        <CheckoutSuccess sessionId={sessionId} />
        <Link href="/" className="secondary-button mt-7 inline-block">กลับหน้าแรก</Link>
      </section>
    </main>
  );
}
