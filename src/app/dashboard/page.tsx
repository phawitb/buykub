import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardOverview() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, slug, name")
    .eq("owner_id", user!.id)
    .maybeSingle();

  if (!shop) {
    return (
      <div className="max-w-lg">
        <h1 className="text-xl font-bold text-ink">ยินดีต้อนรับ</h1>
        <p className="mt-2 text-sm text-ink-soft">
          ยังไม่มีร้าน — ตั้งชื่อร้านและลิงก์ของคุณเพื่อเริ่มขาย
        </p>
        <Link
          href="/dashboard/shop"
          className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper"
        >
          สร้างร้านของคุณ
        </Link>
      </div>
    );
  }

  const [{ count: productCount }, { count: orderCount }, { data: orders }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id),
      supabase.from("orders").select("price_cents").eq("shop_id", shop.id),
    ]);

  const totalCents = (orders ?? []).reduce((sum, o) => sum + o.price_cents, 0);

  const cards = [
    { label: "สินค้าทั้งหมด", value: productCount ?? 0 },
    { label: "ออเดอร์ทั้งหมด (Demo)", value: orderCount ?? 0 },
    { label: "ยอดขายรวม (Demo)", value: `฿${(totalCents / 100).toLocaleString("th-TH")}` },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-ink">สวัสดี, {shop.name}</h1>
      <p className="mt-1 text-sm text-muted">
        ร้านของคุณ:{" "}
        <a href={`/${shop.slug}`} target="_blank" className="font-medium text-ink underline">
          framelink.app/{shop.slug}
        </a>
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-paper-dim p-5">
            <p className="text-xs text-muted">{c.label}</p>
            <p className="mt-1 text-xl font-bold text-ink">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
