import Link from "next/link";

const benefits = [
  "ค่าธรรมเนียม 5% ต่อออเดอร์",
  "สินค้าไม่จำกัด",
  "จองไม่จำกัด",
  "ไม่มีลายน้ำ",
  "โอนเงินทุกวันจันทร์",
];

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-line py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            เลือกแพลนที่ใช่
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">
            ไม่ต้องเลือกแพลน ทุกคนใช้ฟีเจอร์ขายสินค้าและรับจองได้ครบ
            จ่ายเฉพาะเมื่อขายได้
          </p>
        </div>

        <article className="relative mx-auto mt-12 max-w-xl overflow-hidden rounded-3xl border-2 border-accent bg-paper p-8 text-ink shadow-[0_24px_70px_rgba(0,0,0,0.08)] sm:p-10">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            สำหรับทุกคน
          </p>
          <p className="mt-3 text-3xl font-bold">ไม่มีค่าสมาชิกรายเดือน</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            เปิดร้านได้ทันที ไม่มีค่าแรกเข้า และไม่มีเงื่อนไขอัปเกรด
          </p>

          <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-2">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3 text-ink-soft">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent"
                  aria-hidden
                >
                  ✓
                </span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/login?next=%2Fdashboard"
            className="mt-8 block w-full rounded-full bg-accent px-5 py-3.5 text-center text-sm font-semibold text-paper transition hover:bg-accent-hover"
          >
            เริ่มเปิดร้านฟรี
          </Link>
        </article>
      </div>
    </section>
  );
}
