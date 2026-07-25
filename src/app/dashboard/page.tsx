import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CopyLinkButton } from "./CopyLinkButton";

const WEEKDAYS_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];

function nextMonday(from: Date) {
  const d = new Date(from);
  const day = d.getDay();
  const add = day === 1 ? 7 : ((8 - day) % 7 || 7);
  d.setDate(d.getDate() + add);
  return d;
}

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
          href="/dashboard/settings"
          className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper"
        >
          สร้างร้านของคุณ
        </Link>
      </div>
    );
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekAgo = new Date(now.getTime() - 6 * 86400000);
  weekAgo.setHours(0, 0, 0, 0);
  const guaranteeCutoff = new Date(now.getTime() - 7 * 86400000).toISOString();

  const [{ count: productCount }, { data: monthOrders }, { data: recentOrders }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id),
      supabase
        .from("orders")
        .select("price_cents, created_at")
        .eq("shop_id", shop.id)
        .gte("created_at", monthStart),
      supabase
        .from("orders")
        .select("id, price_cents, created_at, products(name)")
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const monthTotalCents = (monthOrders ?? []).reduce((sum, o) => sum + o.price_cents, 0);
  const orderCount = monthOrders?.length ?? 0;

  const readyCents = (monthOrders ?? [])
    .filter((o) => o.created_at < guaranteeCutoff)
    .reduce((sum, o) => sum + o.price_cents, 0);
  const pendingCents = monthTotalCents - readyCents;

  const dayTotals = WEEKDAYS_TH.map((label, i) => {
    const dayStart = new Date(weekAgo);
    dayStart.setDate(weekAgo.getDate() + i);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const total = (monthOrders ?? [])
      .filter((o) => {
        const t = new Date(o.created_at);
        return t >= dayStart && t < dayEnd;
      })
      .reduce((sum, o) => sum + o.price_cents, 0);
    return { label, total };
  });
  const maxDay = Math.max(1, ...dayTotals.map((d) => d.total));

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink">
            สวัสดี, {user?.user_metadata?.full_name ?? shop.name}
          </h1>
          <p className="mt-1 text-sm text-muted">ภาพรวมร้านของคุณวันนี้</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full border border-line bg-paper-dim px-3 py-1 text-xs text-ink-soft">
              framelink.app/{shop.slug}
            </span>
            <CopyLinkButton text={`framelink.app/${shop.slug}`} />
          </div>
        </div>
        <a
          href={`/${shop.slug}`}
          target="_blank"
          className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
        >
          ดูหน้าร้าน ↗
        </a>
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-paper-dim p-6">
        <p className="text-xs text-muted">
          ยอดขายเดือนนี้ · {now.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
        </p>
        <p className="mt-1 text-3xl font-bold text-ink">
          ฿{(monthTotalCents / 100).toLocaleString("th-TH")}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-6 border-t border-line pt-5 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted">ออเดอร์เดือนนี้</p>
            <p className="mt-1 text-lg font-bold text-ink">{orderCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted">สินค้าที่เปิดขาย</p>
            <p className="mt-1 text-lg font-bold text-ink">{productCount ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-paper p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">รายได้รอโอน</p>
          <span className="text-xs text-muted">
            รอบถัดไป {WEEKDAYS_TH[1]} {nextMonday(now).toLocaleDateString("th-TH")}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-paper-dim p-4">
            <p className="text-xs text-muted">พร้อมเข้ารอบโอน</p>
            <p className="mt-1 text-lg font-bold text-ink">
              ฿{(readyCents / 100).toLocaleString("th-TH")}
            </p>
          </div>
          <div className="rounded-xl bg-paper-dim p-4">
            <p className="text-xs text-muted">รอครบประกัน 7 วัน</p>
            <p className="mt-1 text-lg font-bold text-ink">
              ฿{(pendingCents / 100).toLocaleString("th-TH")}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">
          ระบบจะโอนเข้าช่องทางรับเงินของคุณทุกวันจันทร์ — แต่ละยอดขายเข้ารอบโอนหลังพ้นระยะรับประกันคืนเงิน 7 วัน
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-paper p-6">
        <p className="text-sm font-semibold text-ink">ยอดขาย 7 วันล่าสุด</p>
        <div className="mt-5 flex items-end justify-between gap-2">
          {dayTotals.map((d) => (
            <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-24 w-full items-end">
                <div
                  className="w-full rounded-t bg-ink"
                  style={{ height: `${Math.max(4, (d.total / maxDay) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">ออเดอร์ล่าสุด</p>
          <Link href="/dashboard/orders" className="text-xs font-medium text-ink-soft hover:text-ink">
            ดูทั้งหมด →
          </Link>
        </div>

        <div className="mt-3 space-y-2">
          {(recentOrders ?? []).map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-xl border border-line bg-paper p-4 text-sm"
            >
              <span className="text-ink">
                {(o.products as unknown as { name: string } | null)?.name ?? "สินค้า"}
              </span>
              <span className="font-semibold text-ink">
                +฿{(o.price_cents / 100).toLocaleString("th-TH")}
              </span>
            </div>
          ))}

          {(!recentOrders || recentOrders.length === 0) && (
            <div className="rounded-xl border border-dashed border-line p-6 text-center">
              <p className="text-sm text-ink-soft">ยังไม่มีออเดอร์ — เริ่มเพิ่มสินค้ากันเลย!</p>
              <div className="mt-4 flex justify-center gap-3">
                <Link
                  href="/dashboard/products/new"
                  className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper"
                >
                  + สร้างสินค้า
                </Link>
                <Link
                  href="/dashboard/bookings/new"
                  className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink"
                >
                  + สร้างบริการจอง
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
