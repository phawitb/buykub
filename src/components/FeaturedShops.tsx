import Link from "next/link";

const shops = [
  {
    name: "บ้านสวนสีเขียว",
    slug: "baansuan",
    bio: "ไอเดียแต่งสวนเล็กในคอนโด ขายคู่มือปลูกต้นไม้ในเมือง",
    products: [
      { name: "คู่มือแต่งสวนคอนโด", price: "฿149" },
      { name: "ปฏิทินรดน้ำต้นไม้", price: "฿59" },
    ],
  },
  {
    name: "Coach นก",
    slug: "coachnok",
    bio: "โค้ชด้านการเงินส่วนบุคคล ให้คำปรึกษา 1:1",
    products: [
      { name: "คอนซัลต์วางแผนการเงิน", price: "฿990" },
      { name: "เทมเพลตงบประมาณรายเดือน", price: "฿99" },
    ],
  },
  {
    name: "Studio เพ้นท์",
    slug: "paintstudio",
    bio: "ขายพรีเซ็ตสีและคอร์สวาดภาพดิจิทัล",
    products: [{ name: "พรีเซ็ตสี 50 แบบ", price: "฿129" }],
  },
  {
    name: "ติวเตอร์แนน",
    slug: "tutornan",
    bio: "ชีตสรุปและคลาสออนไลน์สำหรับเตรียมสอบภาษาอังกฤษ",
    products: [
      { name: "ชีต Grammar ฉบับย่อ", price: "฿89" },
      { name: "คลาสติวสอบ 60 นาที", price: "฿590" },
    ],
  },
  {
    name: "ร้านหมึกดี",
    slug: "mukdee",
    bio: "เทมเพลตเอกสารและเครื่องมือจัดระบบสำหรับฟรีแลนซ์",
    products: [
      { name: "ชุดใบเสนอราคา 20 แบบ", price: "฿149" },
      { name: "ระบบจัดการลูกค้า Notion", price: "฿249" },
    ],
  },
  {
    name: "Design ลัดดา",
    slug: "ladda-design",
    bio: "กราฟิกพร้อมใช้สำหรับเจ้าของร้านออนไลน์และครีเอเตอร์",
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

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((s) => (
            <Link
              key={s.slug}
              href="/login?next=%2Fdashboard"
              aria-label={`สร้างร้านแบบ ${s.name}`}
              className="group rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              <article className="h-full rounded-2xl border border-line bg-paper p-6 transition group-hover:-translate-y-0.5 group-hover:border-ink">
                <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">
                  {s.name.slice(0, 1).toUpperCase()}
                </div>
                <h3 className="font-bold text-ink">{s.name}</h3>
                <p className="text-xs text-muted">framelink.app/{s.slug}</p>
                <p className="mt-2 text-sm text-ink-soft">{s.bio}</p>

                <div className="mt-4 space-y-2 border-t border-line pt-4">
                  {s.products.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <span className="text-ink-soft">{p.name}</span>
                      <span className="font-semibold text-ink">{p.price}</span>
                    </div>
                  ))}
                </div>

                <p className="mt-5 text-sm font-semibold text-ink">
                  สร้างร้านแบบนี้ →
                </p>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
