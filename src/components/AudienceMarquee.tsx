const audiences = [
  "ครีเอเตอร์",
  "โค้ช",
  "ฟรีแลนซ์",
  "ครูสอนพิเศษ",
  "ที่ปรึกษา",
  "คนขาย E-book",
  "คนขาย Template",
];

const shops = [
  { name: "บ้านสวนสีเขียว", slug: "baansuan" },
  { name: "Coach นก", slug: "coachnok" },
  { name: "ร้านหมึกดี", slug: "mukdee" },
  { name: "Studio เพ้นท์", slug: "paintstudio" },
  { name: "ติวเตอร์แนน", slug: "tutornan" },
  { name: "Design ลัดดา", slug: "ladda-design" },
];

export function AudienceMarquee() {
  return (
    <section className="border-y border-line bg-paper-dim py-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-6">
        {audiences.map((a) => (
          <span
            key={a}
            className="rounded-full border border-line bg-paper px-4 py-1.5 text-sm text-ink-soft"
          >
            {a}
          </span>
        ))}
      </div>

      <div className="mt-8 overflow-hidden">
        <div className="flex w-max animate-[marquee_28s_linear_infinite] gap-4 px-6">
          {[...shops, ...shops].map((s, i) => (
            <div
              key={`${s.slug}-${i}`}
              className="flex shrink-0 items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3"
            >
              <div className="h-8 w-8 rounded-full bg-ink" />
              <div>
                <p className="text-sm font-semibold text-ink">{s.name}</p>
                <p className="text-xs text-muted">framelink.app/{s.slug}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
