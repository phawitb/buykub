import Link from "next/link";

const stats = [
  { value: "50+", label: "ร้านที่เปิดใช้งานแล้ว" },
  { value: "฿300K+", label: "ยอดขายรวมผ่านระบบ" },
  { value: "ทุกสัปดาห์", label: "รอบโอนเงิน ตรงเวลาทุกครั้ง" },
];

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl grid-cols-1 gap-16 px-6 pb-24 pt-16 lg:grid-cols-2 lg:items-center lg:pt-24">
      <div>
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Biolink ที่ขายของได้จริง
        </p>
        <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl">
          แปะลิงก์
          <br />
          <span className="text-muted">ขายได้เลย</span>
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
          ร้านค้าออนไลน์ในลิงก์เดียว สำหรับครีเอเตอร์ไทย ไม่ต้องทำเว็บเอง
          ไม่ต้องใช้บัตรเครดิต รับเงินผ่านพร้อมเพย์ได้ทันที
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/login"
            className="rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-paper transition hover:opacity-85"
          >
            สร้างร้านฟรี →
          </Link>
          <Link
            href="#pricing"
            className="text-sm font-semibold text-ink-soft hover:text-ink"
          >
            ดูราคา →
          </Link>
        </div>

        <p className="mt-4 text-xs text-muted">
          ฟรีเริ่มต้น · ไม่ต้องผูกบัตร · เลิกใช้เมื่อไหร่ก็ได้
        </p>

        <dl className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-8">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-2xl font-bold text-ink">{s.value}</dt>
              <dd className="mt-1 text-xs leading-snug text-muted">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="relative">
        <div className="overflow-hidden rounded-3xl border border-line bg-paper shadow-[0_1px_0_0_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-center border-b border-line bg-paper-dim px-4 py-3">
            <span className="rounded-full bg-paper px-4 py-1 text-xs text-muted">
              framelink.app/kanya
            </span>
          </div>

          <div className="h-24 bg-[repeating-linear-gradient(135deg,var(--color-paper-dim)_0px,var(--color-paper-dim)_10px,var(--color-paper)_10px,var(--color-paper)_20px)]" />

          <div className="px-6 pb-6 pt-5">
            <div className="-mt-14 mb-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-paper bg-ink text-xl font-bold text-paper">
              ก
            </div>
            <h3 className="text-lg font-bold text-ink">กัญญา — สอนออกแบบกราฟิก</h3>
            <p className="mt-1 text-sm text-muted">คอร์สออนไลน์ · ให้คำปรึกษา 1:1</p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line p-3">
                <div className="mb-3 h-16 rounded-lg bg-paper-dim" />
                <p className="text-sm font-medium text-ink">คอร์สเริ่มต้น Figma</p>
                <p className="text-sm font-bold text-ink">฿990</p>
              </div>
              <div className="rounded-xl border border-line p-3">
                <div className="mb-3 h-16 rounded-lg bg-paper-dim" />
                <p className="text-sm font-medium text-ink">ชุดฟอนต์ 80 แบบ</p>
                <p className="text-sm font-bold text-ink">฿199</p>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -bottom-6 -left-6 flex items-center gap-3 rounded-2xl border border-line bg-ink px-5 py-4 text-paper shadow-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-paper/15 text-sm">
            ✓
          </span>
          <div>
            <p className="text-xs text-paper/60">เงินเข้าแล้ว</p>
            <p className="text-sm font-bold">+฿990.00</p>
          </div>
        </div>
      </div>
    </section>
  );
}
