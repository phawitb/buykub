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
    title: "โอนเงินทุกวันจันทร์",
    body: "รายได้โอนเข้าบัญชีทุกวันจันทร์ หักค่าธรรมเนียมให้อัตโนมัติ ไม่ต้องคำนวณเอง",
  },
];

function FeatureVisual({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div
        role="img"
        aria-label="ตัวอย่างส่งไฟล์ดิจิทัลอัตโนมัติ"
        className="mt-6 rounded-xl bg-paper-dim p-4"
      >
        <div className="flex items-center gap-3 rounded-lg border border-line bg-paper p-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-[10px] font-bold text-accent">PDF</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-ink">ebook-final.pdf</p>
            <p className="text-[10px] text-muted">12.4 MB</p>
          </div>
          <span className="text-xs text-emerald-600">✓</span>
        </div>
        <p className="mt-3 text-center text-[10px] text-muted">ส่งให้ลูกค้าทันทีหลังจ่าย</p>
      </div>
    );
  }
  if (index === 1) {
    return (
      <div
        role="img"
        aria-label="ตัวอย่างปฏิทินจองบริการ"
        className="mt-6 rounded-xl bg-paper-dim p-4"
      >
        <div className="mb-3 flex items-center justify-between text-[10px]">
          <span className="font-semibold text-ink">กรกฎาคม 2569</span>
          <span className="text-muted">‹ ›</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 21 }, (_, day) => (
            <span
              key={day}
              className={`flex aspect-square items-center justify-center rounded text-[9px] ${
                day === 11 ? "bg-accent text-paper" : "bg-paper text-muted"
              }`}
            >
              {day + 1}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (index === 2) {
    return (
      <div
        role="img"
        aria-label="ตัวอย่างการรับชำระเงิน"
        className="mt-6 flex items-center gap-4 rounded-xl bg-paper-dim p-4"
      >
        <div className="grid size-16 grid-cols-4 gap-1 rounded-lg bg-paper p-2 shadow-sm">
          {Array.from({ length: 16 }, (_, cell) => (
            <span key={cell} className={cell % 3 === 0 ? "bg-ink" : "bg-line"} />
          ))}
        </div>
        <div>
          <p className="text-xs font-semibold text-ink">สแกน PromptPay</p>
          <p className="mt-1 text-[10px] text-muted">หรือชำระด้วยบัตรเครดิต</p>
          <div className="mt-3 flex gap-1">
            <span className="rounded bg-paper px-2 py-1 text-[9px] text-muted">VISA</span>
            <span className="rounded bg-paper px-2 py-1 text-[9px] text-muted">PromptPay</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label="ตัวอย่างรายการโอนเงินทุกวันจันทร์"
      className="mt-6 space-y-2 rounded-xl bg-paper-dim p-4"
    >
      {[
        ["จ. 20 ก.ค.", "+฿2,410"],
        ["จ. 13 ก.ค.", "+฿1,875"],
        ["จ. 6 ก.ค.", "+฿3,320"],
      ].map(([date, amount]) => (
        <div key={date} className="flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-[10px]">
          <span className="text-muted">{date}</span>
          <span className="font-bold text-emerald-600">{amount}</span>
        </div>
      ))}
    </div>
  );
}

export function Features() {
  return (
    <section className="border-t border-line bg-paper-dim py-24">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Features
        </p>
        <h2 className="mt-3 max-w-lg text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          ทุกอย่างที่คุณต้องการ
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
          ครบจบในที่เดียว ไม่ต้องสลับหลายเครื่องมือ ตั้งแต่สร้างร้านจนถึงรับเงิน
        </p>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {features.map((f, index) => (
            <div
              key={f.title}
              className="rounded-2xl border border-line bg-paper p-7"
            >
              <h3 className="text-lg font-bold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
              <FeatureVisual index={index} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
