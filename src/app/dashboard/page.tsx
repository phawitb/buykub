import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  bangkokDateKey,
  nextBangkokMonday,
  recentBangkokDays,
  startOfBangkokMonth,
} from "@/lib/bangkok-date";
import { CopyLinkButton } from "./CopyLinkButton";
import { OverviewCards } from "./OverviewCards";
import { SalesChart } from "./SalesChart";

const WEEKDAYS_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];

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
          className="mt-6 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-paper hover:bg-accent-hover"
        >
          สร้างร้านของคุณ
        </Link>
      </div>
    );
  }

  const now = new Date();
  const monthStart = startOfBangkokMonth(now);
  const recentDays = recentBangkokDays(7, now);
  const weekAgo = `${recentDays[0].key}T00:00:00+07:00`;
  const guaranteeCutoff = new Date(now.getTime() - 7 * 86400000).toISOString();

  const [
    { count: productCount },
    { data: monthOrders },
    { data: weekOrders },
    { data: recentOrders },
  ] = await Promise.all([
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
        .select("price_cents, created_at")
        .eq("shop_id", shop.id)
        .gte("created_at", weekAgo),
      supabase
        .from("orders")
        .select("id, price_cents, created_at, products(name)")
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const monthTotalCents = (monthOrders ?? []).reduce((sum, o) => sum + o.price_cents, 0);
  const orderCount = monthOrders?.length ?? 0;
  const netIncomeCents = Math.round(monthTotalCents * 0.92);

  const readyCents = (monthOrders ?? [])
    .filter((o) => o.created_at < guaranteeCutoff)
    .reduce((sum, o) => sum + o.price_cents, 0);
  const pendingCents = monthTotalCents - readyCents;

  const dayTotals = recentDays.map((day) => {
    const total = (weekOrders ?? [])
      .filter((order) => bangkokDateKey(new Date(order.created_at)) === day.key)
      .reduce((sum, o) => sum + o.price_cents, 0);
    return {
      key: day.key,
      label: day.label,
      total,
    };
  });

  return (
    <div className="max-w-4xl">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink sm:text-2xl">
            สวัสดี, {user?.user_metadata?.full_name ?? shop.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            ภาพรวมร้านของคุณวันนี้{" "}
            <span className="hidden sm:inline">
              ·{" "}
              {now.toLocaleDateString("th-TH", {
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Bangkok",
              })}
            </span>
          </p>
          </div>
        <a
          href={`/${shop.slug}`}
          target="_blank"
          className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-paper hover:bg-accent-hover"
        >
          ดูหน้าร้าน ↗
        </a>
        </div>
        <div className="mt-3 flex w-fit max-w-full items-center overflow-hidden rounded-full border border-line bg-paper">
          <span className="truncate py-1.5 pl-3 pr-2 text-xs text-ink-soft">
            framelink.app/{shop.slug}
          </span>
          <CopyLinkButton text={`framelink.app/${shop.slug}`} />
        </div>
      </div>

      <OverviewCards
        monthLabel={now.toLocaleDateString("th-TH", {
          month: "short",
          year: "numeric",
          timeZone: "Asia/Bangkok",
        })}
        grossCents={monthTotalCents}
        netCents={netIncomeCents}
        orderCount={orderCount}
        productCount={productCount ?? 0}
      />

      <div className="mt-6 rounded-2xl border border-line bg-paper p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">รายได้รอโอน</p>
          <span className="text-xs text-muted">
            รอบถัดไป {WEEKDAYS_TH[1]}{" "}
            {nextBangkokMonday(now).toLocaleDateString("th-TH", {
              day: "numeric",
              month: "short",
              timeZone: "UTC",
            })}
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
        <SalesChart days={dayTotals} />
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
                  className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-paper hover:bg-accent-hover"
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
