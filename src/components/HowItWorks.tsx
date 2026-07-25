const steps = [
  {
    n: "01",
    title: "สร้างร้าน",
    body: "สมัครฟรีด้วยอีเมลหรือ Google ตั้งชื่อร้าน เลือก URL ของตัวเอง ใช้เวลาไม่ถึง 2 นาที",
  },
  {
    n: "02",
    title: "เพิ่มสินค้า",
    body: "อัปโหลดไฟล์ดิจิทัลหรือเปิดตารางจอง ตั้งราคา ใส่รายละเอียด พร้อมขายทันที",
  },
  {
    n: "03",
    title: "แปะลิงก์ รับเงิน",
    body: "แปะลิงก์ร้านไว้ใน bio ลูกค้ากดซื้อ จ่ายเงิน รับของอัตโนมัติ เงินเข้าทุกวันจันทร์",
  },
];

function StepVisual({ step }: { step: string }) {
  if (step === "01") {
    return (
      <div
        role="img"
        aria-label="ตัวอย่างการสร้างร้าน"
        className="mb-7 h-44 overflow-hidden rounded-2xl border border-line bg-paper-dim p-4"
      >
        <div className="mx-auto h-full max-w-[210px] overflow-hidden rounded-xl border border-line bg-paper shadow-sm">
          <p className="border-b border-line px-3 py-2 text-center text-[9px] text-muted">
            framelink.app/kanya
          </p>
          <div className="h-9 bg-accent-soft" />
          <div className="px-3">
            <div className="-mt-4 size-8 rounded-full border-2 border-paper bg-ink" />
            <div className="mt-2 h-2 w-24 rounded-full bg-ink/80" />
            <div className="mt-2 h-1.5 w-32 rounded-full bg-line" />
          </div>
        </div>
      </div>
    );
  }
  if (step === "02") {
    return (
      <div
        role="img"
        aria-label="ตัวอย่างการเพิ่มสินค้า"
        className="mb-7 flex h-44 items-center justify-center rounded-2xl border border-line bg-paper-dim p-5"
      >
        <div className="w-full max-w-[230px] rounded-xl border border-line bg-paper p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-accent-soft text-sm font-bold text-accent">
              PDF
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">คู่มือเริ่มขายออนไลน์</p>
              <p className="mt-1 text-[10px] text-muted">ไฟล์ PDF · พร้อมส่ง</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
            <span className="text-muted">ราคาขาย</span>
            <span className="font-bold text-ink">฿249</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label="ตัวอย่างการรับเงินจากลิงก์ร้าน"
      className="mb-7 flex h-44 flex-col justify-center gap-4 rounded-2xl border border-line bg-paper-dim p-5"
    >
      <div className="rounded-full border border-line bg-paper px-4 py-2 text-center text-[10px] text-muted shadow-sm">
        bio → framelink.app/kanya
      </div>
      <div className="ml-auto flex w-[86%] items-center gap-3 rounded-xl bg-ink px-4 py-3 text-paper shadow-lg">
        <span className="flex size-7 items-center justify-center rounded-full bg-paper/15 text-xs">✓</span>
        <div>
          <p className="text-[9px] text-paper/60">เงินเข้าแล้ว</p>
          <p className="text-xs font-bold">+฿1,290</p>
        </div>
      </div>
    </div>
  );
}

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
            <StepVisual step={s.n} />
            <span className="text-sm font-bold text-muted">{s.n}</span>
            <h3 className="mt-3 text-xl font-bold text-ink">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
