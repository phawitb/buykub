import Link from "next/link";

export default function CheckoutCancelledPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-5">
      <section className="w-full rounded-3xl border border-line bg-paper p-8 text-center shadow-lift-1">
        <h1 className="text-2xl font-bold text-ink">ยกเลิกการชำระเงินแล้ว</h1>
        <p className="mt-3 text-sm leading-6 text-muted">ยังไม่มีการเรียกเก็บเงิน คุณสามารถกลับไปเลือกสินค้าและชำระใหม่ได้ทุกเมื่อ</p>
        <Link href="/" className="primary-button mt-7 inline-block">กลับหน้าแรก</Link>
      </section>
    </main>
  );
}
