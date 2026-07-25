const steps = [
  {
    n: "01",
    title: "สร้างร้าน",
    body: "สมัครด้วย Google ตั้งชื่อร้าน เลือก URL ของตัวเอง ใช้เวลาไม่ถึง 2 นาที",
  },
  {
    n: "02",
    title: "เพิ่มสินค้า",
    body: "อัปโหลดไฟล์ดิจิทัลหรือเปิดตารางจอง ตั้งราคา ใส่รายละเอียด พร้อมขายทันที",
  },
  {
    n: "03",
    title: "แปะลิงก์ รับเงิน",
    body: "แปะลิงก์ร้านไว้ใน bio ลูกค้ากดซื้อ จ่ายเงิน รับของอัตโนมัติ เงินเข้าทุกสัปดาห์",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        How it works
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        3 ขั้นตอน เริ่มขายได้ทันที
      </h2>

      <div className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n}>
            <span className="text-sm font-bold text-muted">{s.n}</span>
            <h3 className="mt-3 text-xl font-bold text-ink">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
