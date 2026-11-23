import { CheckIcon } from "@/components/icons";

/**
 * Mirrors the published terms on the landing page. The payout line must stay
 * truthful: a seven-day hold, then a transfer staff make by hand with a slip.
 */
const terms = [
  "ค่าธรรมเนียม 5% ต่อออเดอร์",
  "ไฟล์และคอร์สเรียนไม่จำกัด",
  "ไม่มีลายน้ำ",
  "โอนเข้าบัญชีพร้อมสลิปยืนยัน",
];

export function CommercialTerms() {
  return (
    <section aria-labelledby="commercial-terms-title">
      <h2 id="commercial-terms-title" className="text-sm font-semibold text-ink">
        เงื่อนไขการใช้งาน
      </h2>
      <div className="mt-4 rounded-2xl border border-line bg-paper-dim p-5">
        <p className="text-sm font-semibold text-ink">
          ทุกคนใช้ฟีเจอร์ได้ครบ ไม่มีค่าสมาชิกรายเดือน
        </p>
        <ul className="mt-4 grid gap-3 text-sm text-ink-soft sm:grid-cols-2">
          {terms.map((term) => (
            <li key={term} className="flex items-start gap-2.5">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>{term}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-line pt-4 text-xs leading-6 text-muted">
          ยอดที่ชำระแล้วเข้ารอบจ่ายหลังพ้นระยะถือครอง 7 วัน
          ทีมงานเป็นผู้โอนและแนบสลิปยืนยัน ยังไม่มีระบบโอนอัตโนมัติ
          ถ้าเปิดลิงก์แนะนำให้สินค้า ค่าคอมผู้แนะนำของออเดอร์ที่ซื้อผ่านลิงก์จะหักจากยอดโอนด้วย
        </p>
      </div>
    </section>
  );
}
