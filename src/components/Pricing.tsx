import Link from "next/link";
import { CheckIcon } from "./icons";

/**
 * The 5% fee is a published commitment. The payout line says what happens today:
 * a seven-day hold, then a transfer our team makes by hand with a slip attached.
 * There is no automatic bank transfer and nothing here may imply one.
 */
const included = [
  "ค่าธรรมเนียม 5% ต่อออเดอร์",
  "สินค้าไม่จำกัด",
  "ไม่มีลายน้ำ",
  "โอนเข้าบัญชีพร้อมสลิปยืนยัน",
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 sm:py-24">
      <div className="shell px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl text-ink sm:text-[2.5rem]">
            เริ่มต้นได้ทันทีไม่มีค่าใช้จ่าย
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-ink-soft">
            ไม่ต้องเลือกแพลน ทุกคนใช้ฟีเจอร์ขายสินค้าและคอร์สออนไลน์ได้ครบ
          </p>
        </div>

        <article className="card relative mx-auto mt-12 max-w-xl overflow-hidden p-8 text-ink shadow-lift-3 sm:p-10">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" aria-hidden />
          <p className="text-[1.75rem] font-medium">ไม่มีค่าสมาชิกรายเดือน</p>
          <p className="mt-2.5 text-sm leading-7 text-muted">
            เปิดร้านได้ทันที ไม่มีค่าแรกเข้า และไม่มีเงื่อนไขอัปเกรด
          </p>

          <ul className="mt-8 grid gap-3.5 text-sm sm:grid-cols-2">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-3 text-ink-soft">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-accent-text" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <p className="mt-6 border-t border-line pt-5 text-xs leading-6 text-muted">
            ยอดที่ชำระแล้วจะเข้ารอบจ่ายหลังพ้นระยะถือครอง 7 วัน
            ทีมงานเป็นผู้โอนเข้าบัญชีของคุณและแนบสลิปยืนยันทุกครั้ง
            รายการที่ถูกคืนเงินหรืออยู่ระหว่างข้อพิพาทจะไม่เข้ารอบจ่าย
          </p>

          <Link
            href="/login?next=%2Fdashboard%2Fproducts%3Fcreate%3D1"
            className="mt-8 flex h-12 w-full items-center justify-center rounded-full bg-accent text-[15px] font-medium text-on-ink transition duration-[120ms] ease-out hover:bg-accent-hover active:scale-[0.98]"
          >
            เริ่มเปิดร้านฟรี
          </Link>
        </article>
      </div>
    </section>
  );
}
