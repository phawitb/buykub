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
];

export function FeaturedShops() {
  return (
    <section className="border-t border-line bg-paper-dim py-24">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Featured shops
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          ร้านจริงที่เปิดอยู่บน Framelink
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((s) => (
            <div key={s.slug} className="rounded-2xl border border-line bg-paper p-6">
              <div className="mb-4 h-10 w-10 rounded-full bg-ink" />
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

              <p className="mt-5 text-sm font-semibold text-ink">เข้าชมร้าน →</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
