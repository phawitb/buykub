const plans = [
  {
    name: "FREE",
    price: "฿0",
    period: "ตลอดไป",
    highlight: false,
    features: [
      "ค่าธรรมเนียม 8% ต่อออเดอร์",
      "สินค้าดิจิทัลได้ 5 ชิ้น",
      "บริการจองได้ 5 รายการ",
      "โอนเงินทุกสัปดาห์",
      "รับพร้อมเพย์และบัตรเครดิต",
    ],
    cta: "เริ่มต้นฟรี",
  },
  {
    name: "PRO",
    price: "฿399",
    period: "/เดือน",
    highlight: true,
    features: [
      "ค่าธรรมเนียม 2% ต่อออเดอร์",
      "สินค้าไม่จำกัด",
      "จองไม่จำกัด",
      "ไม่มีลายน้ำ",
      "โอนเงินทุกสัปดาห์",
    ],
    cta: "อัปเกรดเป็น Pro",
  },
  {
    name: "PRO+",
    price: "฿899",
    period: "/เดือน",
    highlight: false,
    features: [
      "ค่าธรรมเนียม 0%",
      "ทุกอย่างในแพลน Pro",
      "ซัปพอร์ตแบบเร่งด่วน",
      "โดเมนของตัวเอง (เร็วๆ นี้)",
    ],
    cta: "อัปเกรดเป็น Pro+",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-line py-24">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Pricing
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          เลือกแพลนที่ใช่สำหรับคุณ
        </h2>
        <p className="mt-3 max-w-md text-ink-soft">
          เริ่มต้นฟรี อัปเกรดเมื่อพร้อม ไม่มีสัญญาผูกมัด
        </p>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl border p-7 ${
                p.highlight ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-7 rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink">
                  แนะนำ
                </span>
              )}
              <p className="text-xs font-semibold tracking-widest opacity-60">{p.name}</p>
              <p className="mt-3 text-3xl font-bold">
                {p.price}
                <span className="text-sm font-normal opacity-60"> {p.period}</span>
              </p>

              <ul className="mt-6 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 opacity-90">
                    <span className="mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`mt-7 w-full rounded-full px-5 py-3 text-sm font-semibold transition ${
                  p.highlight
                    ? "bg-paper text-ink hover:opacity-85"
                    : "bg-ink text-paper hover:opacity-85"
                }`}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
