const reasons = [
  {
    n: "01",
    title: "รับพร้อมเพย์ได้ทันที",
    body: "ลูกค้าสแกนจ่ายจบในหน้าเดียว ไม่ต้องผ่านระบบต่างประเทศ ไม่ต้องมีบัญชีธุรกิจ",
  },
  {
    n: "02",
    title: "ภาษาไทย ราคาเป็นบาท",
    body: "ทุกอย่างเป็นภาษาไทยตั้งแต่ต้นจนจบ ไม่ต้องแปลงค่าเงิน ลูกค้าเข้าใจง่าย",
  },
  {
    n: "03",
    title: "เปิดร้านได้ใน 2 นาที",
    body: "ไม่ต้องมีความรู้เรื่องเว็บไซต์ สมัคร ตั้งชื่อร้าน แปะลิงก์ใน bio ก็เริ่มขายได้",
  },
];

export function WhyUs() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        Why Framelink
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        ออกแบบมาสำหรับครีเอเตอร์ไทยโดยเฉพาะ
      </h2>

      <div className="mt-14 grid grid-cols-1 gap-10 border-t border-line pt-12 sm:grid-cols-3">
        {reasons.map((r) => (
          <div key={r.n}>
            <span className="text-sm font-bold text-muted">{r.n}</span>
            <h3 className="mt-3 text-lg font-bold text-ink">{r.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{r.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
