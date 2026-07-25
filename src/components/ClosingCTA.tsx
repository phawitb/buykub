import Link from "next/link";

export function ClosingCTA() {
  return (
    <section className="border-t border-line py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          พร้อมเริ่มขายหรือยัง?
        </h2>
        <p className="mt-3 text-ink-soft">
          สมัครฟรี ตั้งร้านในไม่กี่นาที แปะลิงก์ใน bio แล้วเริ่มมีรายได้
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-full bg-ink px-8 py-3.5 text-sm font-semibold text-paper transition hover:opacity-85"
        >
          เปิดร้านเลย
        </Link>
        <p className="mt-3 text-xs text-muted">ใช้เวลาไม่ถึง 2 นาที</p>
      </div>
    </section>
  );
}
