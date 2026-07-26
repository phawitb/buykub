import Link from "next/link";

const shops = [
  {
    name: "บ้านสวนสีเขียว",
    slug: "baansuan",
    bio: "ไอเดียแต่งสวนเล็กในคอนโด ขายคู่มือปลูกต้นไม้ในเมือง",
    coverClass: "from-emerald-950 via-emerald-700 to-lime-300",
    motif: "✦",
    motifClass: "text-lime-100/80",
    avatarClass: "bg-emerald-950",
    products: [
      { name: "คู่มือแต่งสวนคอนโด", price: "฿149" },
      { name: "ปฏิทินรดน้ำต้นไม้", price: "฿59" },
    ],
  },
  {
    name: "Coach นก",
    slug: "coachnok",
    bio: "โค้ชด้านการเงินส่วนบุคคล ให้คำปรึกษา 1:1",
    coverClass: "from-stone-700 via-amber-100 to-orange-50",
    motif: "฿",
    motifClass: "text-stone-800/70",
    avatarClass: "bg-stone-800",
    products: [
      { name: "คอนซัลต์วางแผนการเงิน", price: "฿990" },
      { name: "เทมเพลตงบประมาณรายเดือน", price: "฿99" },
    ],
  },
  {
    name: "Studio เพ้นท์",
    slug: "paintstudio",
    bio: "ขายพรีเซ็ตสีและคอร์สวาดภาพดิจิทัล",
    coverClass: "from-slate-900 via-slate-500 to-stone-100",
    motif: "◌",
    motifClass: "text-white/80",
    avatarClass: "bg-slate-900",
    products: [{ name: "พรีเซ็ตสี 50 แบบ", price: "฿129" }],
  },
  {
    name: "ติวเตอร์แนน",
    slug: "tutornan",
    bio: "ชีตสรุปและคลาสออนไลน์สำหรับเตรียมสอบภาษาอังกฤษ",
    coverClass: "from-blue-950 via-indigo-600 to-cyan-200",
    motif: "A",
    motifClass: "text-cyan-50/80",
    avatarClass: "bg-blue-950",
    products: [
      { name: "ชีต Grammar ฉบับย่อ", price: "฿89" },
      { name: "คลาสติวสอบ 60 นาที", price: "฿590" },
    ],
  },
  {
    name: "ร้านหมึกดี",
    slug: "mukdee",
    bio: "เทมเพลตเอกสารและเครื่องมือจัดระบบสำหรับฟรีแลนซ์",
    coverClass: "from-zinc-950 via-neutral-700 to-amber-100",
    motif: "N",
    motifClass: "text-amber-50/80",
    avatarClass: "bg-zinc-950",
    products: [
      { name: "ชุดใบเสนอราคา 20 แบบ", price: "฿149" },
      { name: "ระบบจัดการลูกค้า Notion", price: "฿249" },
    ],
  },
  {
    name: "Design ลัดดา",
    slug: "ladda-design",
    bio: "กราฟิกพร้อมใช้สำหรับเจ้าของร้านออนไลน์และครีเอเตอร์",
    coverClass: "from-violet-700 via-fuchsia-500 to-cyan-300",
    motif: "D",
    motifClass: "text-white/85",
    avatarClass: "bg-violet-950",
    products: [
      { name: "Canva Social Pack", price: "฿199" },
      { name: "Sticker Pack Vol. 1", price: "฿99" },
    ],
  },
];

export function FeaturedShops() {
  return (
    <section className="border-t border-line bg-paper-dim py-24">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Featured shops
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          ตัวอย่างร้านที่สร้างได้บน Framelink
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
          ตัวอย่างหน้าร้านสำหรับครีเอเตอร์หลายรูปแบบ — ชื่อและข้อมูลด้านล่างเป็นข้อมูลสาธิต
        </p>

        <div
          data-testid="featured-shop-grid"
          className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {shops.map((s) => (
            <Link
              key={s.slug}
              href="/login?next=%2Fdashboard"
              aria-label={`สร้างร้านแบบ ${s.name}`}
              className="group block h-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:border-ink/40 group-hover:shadow-lg">
                <div
                  data-testid="shop-cover"
                  className={`relative h-36 shrink-0 overflow-hidden bg-gradient-to-br sm:h-40 ${s.coverClass}`}
                >
                  <div
                    data-testid="shop-motif"
                    aria-hidden="true"
                    className="absolute inset-0 transition duration-500 group-hover:scale-105"
                  >
                    <span className="absolute -left-8 -top-10 size-36 rounded-full border border-white/20 bg-white/10 blur-[1px]" />
                    <span className="absolute -bottom-12 right-6 size-32 rounded-full border-[18px] border-white/10" />
                    <span
                      className={`absolute right-7 top-1/2 -translate-y-1/2 text-7xl font-black tracking-tighter ${s.motifClass}`}
                    >
                      {s.motif}
                    </span>
                    <span className="absolute bottom-5 left-6 h-px w-24 bg-white/45" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col px-6 pb-6">
                  <div
                    data-testid="shop-avatar"
                    className={`relative z-10 -mt-7 mb-3 flex size-14 items-center justify-center rounded-full border-4 border-paper text-sm font-bold text-paper shadow-sm ${s.avatarClass}`}
                  >
                    {s.name.slice(0, 1).toUpperCase()}
                  </div>
                  <h3 className="font-bold text-ink">{s.name}</h3>
                  <p className="text-xs text-muted">framelink.app/{s.slug}</p>
                  <p className="mt-2 min-h-10 text-sm leading-6 text-ink-soft">
                    {s.bio}
                  </p>

                  <div className="mt-4 space-y-2 border-t border-line pt-4">
                    {s.products.map((p) => (
                      <div
                        key={p.name}
                        className="flex items-start justify-between gap-4 text-sm"
                      >
                        <span className="text-ink-soft">{p.name}</span>
                        <span className="shrink-0 font-semibold text-ink">
                          {p.price}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-auto pt-6 text-sm font-semibold text-ink">
                    สร้างร้านแบบนี้{" "}
                    <span
                      aria-hidden="true"
                      className="inline-block transition-transform group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </p>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
