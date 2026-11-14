import { CheckIcon, KeyIcon, LibraryIcon } from "./icons";

/**
 * What the platform does *after* the customer pays. Each line maps to
 * behaviour that exists today:
 *  - payment is confirmed by the provider's verified webhook, never a slip;
 *  - files and product keys are released on confirmed payment;
 *  - a course buyer's classroom access opens against their Google account.
 *
 * There is no "add the buyer to a LINE/Discord group" feature — delivery types
 * are file, key and course only — so nothing here claims one.
 */
const handled = [
  {
    Icon: CheckIcon,
    title: "ยืนยันเงินเข้าให้เอง",
    body: "ระบบชำระเงินยืนยันให้โดยตรง ไม่ต้องขอสลิป ไม่ต้องนั่งเทียบยอดในแอปธนาคาร",
  },
  {
    Icon: KeyIcon,
    title: "ส่งของให้เอง",
    body: "ไฟล์และคีย์สินค้าถึงมือลูกค้าทันทีที่ชำระสำเร็จ คีย์ตัดสต็อกทีละใบ ไม่มีทางซ้ำ",
  },
  {
    Icon: LibraryIcon,
    title: "เปิดสิทธิ์ให้เอง",
    body: "คนซื้อคอร์สเข้าห้องเรียนได้ทันที ผูกกับบัญชี Google ของเขา หมดอายุตามที่คุณตั้งไว้",
  },
];

export function StepsBand() {
  return (
    <section id="how" className="bg-ground-dark py-20 text-on-ink sm:py-24">
      <div className="shell grid gap-14 px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:gap-16">
        <div>
          <h2 className="text-3xl leading-tight text-on-ink sm:text-[2.25rem]">
            ลงของครั้งเดียว
            <br />
            ที่เหลือเราทำให้
          </h2>
          <p className="measure mt-5 text-[15px] leading-8 text-on-ink-soft">
            หลังลูกค้ากดจ่าย ระบบจัดการต่อให้เองทั้งหมด คุณแค่รอเงินเข้าบัญชี
            ค่าธรรมเนียมเพียง 5% ต่อออเดอร์ ไม่มีค่ารายเดือน
          </p>
        </div>

        <dl className="divide-y divide-white/10 border-y border-white/10">
          {handled.map(({ Icon, title, body }) => (
            <div key={title} className="grid gap-3 py-7 sm:grid-cols-[auto_1fr] sm:gap-6">
              <span className="flex size-11 items-center justify-center rounded-full border border-white/15 text-on-ink">
                <Icon className="size-5" />
              </span>
              <div>
                <dt className="text-lg font-medium text-on-ink">{title}</dt>
                <dd className="mt-1.5 text-sm leading-7 text-on-ink-soft">{body}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
