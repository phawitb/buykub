import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[65vh] items-center justify-center px-2">
      <div className="w-full max-w-md rounded-3xl border border-line bg-paper p-8 text-center shadow-sm sm:p-10">
        <div
          aria-hidden
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-2xl text-accent"
        >
          ◇
        </div>
        <h1 className="mt-5 text-xl font-bold text-ink">
          ไม่พบข้อมูลที่ต้องการ
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          รายการนี้อาจถูกลบ เปลี่ยนลิงก์ หรือไม่ได้อยู่ในร้านของคุณ
        </p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="secondary-button justify-center"
          >
            กลับหน้าหลังร้าน
          </Link>
          <Link
            href="/dashboard/products"
            className="primary-button justify-center"
          >
            ไปหน้าสินค้า
          </Link>
        </div>
      </div>
    </div>
  );
}
