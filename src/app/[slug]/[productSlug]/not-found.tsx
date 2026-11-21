import Link from "next/link";

export default function ProductNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f7] px-5">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-paper p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-paper-dim text-2xl text-muted">
          ◇
        </div>
        <h1 className="mt-5 text-xl font-bold text-ink">ไม่พบสินค้านี้</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          สินค้าอาจถูกซ่อน ลบ หรือเปลี่ยนลิงก์แล้ว
        </p>
        <Link href="/" className="primary-button mt-6">
          กลับหน้าแรก
        </Link>
      </div>
    </main>
  );
}
