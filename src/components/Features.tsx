const features = [
  {
    title: "ขายสินค้าดิจิทัล",
    body: "E-book, Template, ไฟล์เสียงหรือวิดีโอ — อัปโหลดไฟล์ ตั้งราคา ลูกค้าจ่ายแล้วดาวน์โหลดได้ทันที",
  },
  {
    title: "เปิดจองบริการ",
    body: "โค้ช ที่ปรึกษา ครูสอนพิเศษ — เปิดตารางว่าง ให้ลูกค้าจองคิว พร้อมลิงก์ประชุมออนไลน์อัตโนมัติ",
  },
  {
    title: "รับเงินอัตโนมัติ",
    body: "รองรับพร้อมเพย์และบัตรเครดิต ผ่านระบบชำระเงินมาตรฐาน ไม่ต้องมีบัญชีธุรกิจ",
  },
  {
    title: "โอนเงินทุกสัปดาห์",
    body: "รายได้โอนเข้าบัญชีทุกสัปดาห์ หักค่าธรรมเนียมให้อัตโนมัติ ไม่ต้องคำนวณเอง",
  },
];

export function Features() {
  return (
    <section className="border-t border-line bg-paper-dim py-24">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Features
        </p>
        <h2 className="mt-3 max-w-lg text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          ทุกอย่างที่ต้องใช้ ครบในที่เดียว
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-line bg-paper p-7"
            >
              <div className="mb-5 h-10 w-10 rounded-full border border-line" />
              <h3 className="text-lg font-bold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
