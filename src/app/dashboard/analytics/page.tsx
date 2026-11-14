import Link from "next/link";
import { redirect } from "next/navigation";
import { getSellerContext } from "@/lib/supabase/seller-context";
import { bangkokDateKey, recentBangkokDays } from "@/lib/bangkok-date";
import { SalesChart } from "../SalesChart";
import { OrderTabs } from "../orders/OrderTabs";
import { ConversionFunnel } from "./ConversionFunnel";
import { RangeTabs } from "./RangeTabs";
import { normalizeAnalyticsRange, summarizeOrders } from "./summary";
import { readAllRows } from "./read-all";
import { ArrowDownIcon, ArrowRightIcon } from "@/components/icons";

type IncomingOrder = {
  id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  payment_method: string | null;
  price_cents: number;
  status: string;
  created_at: string;
  products: { name: string } | null;
};

function baht(cents: number) {
  return `฿${(cents / 100).toLocaleString("th-TH")}`;
}

export default async function AnalyticsPage({ searchParams }: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const days = normalizeAnalyticsRange((await searchParams).range);
  const { supabase, shop } = await getSellerContext();

  if (!shop) redirect("/learn");

  const now = new Date();
  const chartCalendarDays = recentBangkokDays(days, now);
  const since = `${chartCalendarDays[0].key}T00:00:00+07:00`;
  const [events, orderRows, productsResult] = await Promise.all([
    readAllRows((from, to) => supabase.from("analytics_events").select("event_type, created_at")
      .eq("shop_id", shop.id).gte("created_at", since).lte("created_at", now.toISOString())
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to)),
    readAllRows((from, to) => supabase.from("orders")
      .select("id, buyer_name, buyer_email, payment_method, price_cents, status, created_at, products(name)")
      .eq("shop_id", shop.id).lte("created_at", now.toISOString())
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to)),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
  ]);
  // An unavailable data source is an error, never a zero balance.
  if (productsResult.error) throw productsResult.error;

  const orders = orderRows as unknown as IncomingOrder[];
  const summary = summarizeOrders(orders, days, now);
  const views = events.filter((event) => event.event_type === "view_product").length;
  const buyClicks = events.filter((event) => event.event_type === "click_buy").length;
  const checkoutOpens = events.filter((event) => event.event_type === "open_checkout").length;
  const conversion = views > 0 ? (summary.rangeOrderCount / views) * 100 : 0;
  const viewsByDay: Record<string, number> = {};
  for (const event of events) {
    if (event.event_type !== "view_product") continue;
    const key = bangkokDateKey(new Date(event.created_at));
    viewsByDay[key] = (viewsByDay[key] ?? 0) + 1;
  }
  const chartDays = chartCalendarDays.map((day) => ({
    key: day.key,
    label: day.date.toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }),
    views: viewsByDay[day.key] ?? 0,
    purchases: summary.purchasesByDay[day.key] ?? 0,
  }));
  const chartMax = Math.max(1, ...chartDays.flatMap((day) => [day.views, day.purchases]));

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Analytics</h1>
          <p className="mt-1 text-sm text-muted">ภาพรวมร้าน ยอดขาย และออเดอร์ที่ได้รับ</p>
        </div>
        <a href="#orders" className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink">ดูออเดอร์<ArrowDownIcon className="ml-1.5 inline size-3.5 align-[-0.15em]" /></a>
      </div>

      <section aria-labelledby="monthly-overview" className="mt-8">
        <h2 id="monthly-overview" className="text-sm font-semibold text-ink">ภาพรวมเดือนนี้</h2>
        <p className="mt-1 text-xs text-muted">{now.toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" })} · นับเฉพาะออเดอร์ที่ชำระแล้ว</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 rounded-2xl border border-line bg-paper p-5">
            <p className="text-xs text-muted">ยอดขายเดือนนี้</p>
            <p className="mt-2 text-3xl font-bold text-ink">{baht(summary.monthSalesCents)}</p>
            <p className="mt-4 border-t border-line pt-4 text-xs text-muted">หลังหักค่าบริการแพลตฟอร์ม 5% (ประมาณ) <span className="font-semibold text-emerald-700">{baht(summary.monthEstimatedNetCents)}</span></p>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <p className="text-xs text-muted">ออเดอร์ที่ชำระแล้ว</p>
            <p className="mt-2 text-3xl font-bold text-ink">{summary.monthOrderCount.toLocaleString("th-TH")}</p>
            <p className="mt-4 text-xs text-muted">เฉลี่ย {baht(summary.monthOrderCount ? Math.round(summary.monthSalesCents / summary.monthOrderCount) : 0)} / ออเดอร์</p>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <p className="text-xs text-muted">สินค้าทั้งหมด</p>
            <p className="mt-2 text-3xl font-bold text-ink">{(productsResult.count ?? 0).toLocaleString("th-TH")}</p>
            <Link href="/dashboard/products" className="mt-4 inline-block text-xs font-semibold text-accent">จัดการร้านค้า<ArrowRightIcon className="ml-1.5 inline size-3.5 align-[-0.15em]" /></Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="payout-estimates" className="mt-6 rounded-2xl border border-line bg-paper p-6">
        <h2 id="payout-estimates" className="text-sm font-semibold text-ink">ยอดรับเงินโดยประมาณ</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["ยอดขายที่ชำระแล้วทั้งหมด", summary.totalSalesCents],
            ["พ้นประกัน 7 วัน (ประมาณ)", summary.estimatedMaturedCents],
            ["อยู่ในช่วงประกัน 7 วัน (ประมาณ)", summary.estimatedGuaranteeCents],
          ].map(([label, cents]) => (
            <div key={label} className="rounded-xl bg-paper-dim p-4">
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 text-lg font-bold text-ink">{baht(Number(cents))}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">ตัวเลขนี้ประมาณจากยอดขายที่ชำระแล้วก่อนหักค่าธรรมเนียมและอายุออเดอร์ ไม่ใช่ยอดโอนจริงหรือยอดคงเหลือที่ถอนได้ และยังไม่ได้หักเงินที่เคยโอนไปแล้ว</p>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-paper p-6">
        <h2 className="text-sm font-semibold text-ink">ยอดขายที่ชำระแล้ว 7 วันล่าสุด</h2>
        <SalesChart days={summary.salesDays} />
      </section>

      <section aria-labelledby="range-overview" className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="range-overview" className="text-sm font-semibold text-ink">การเข้าชมและยอดขาย · {days} วัน</h2>
          <RangeTabs current={String(days)} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "ยอดขายที่ชำระแล้ว", value: baht(summary.rangeSalesCents), detail: `${summary.rangeOrderCount} ออเดอร์` },
            { label: "เข้าชมสินค้า", value: views.toLocaleString("th-TH"), detail: "รวมทุกสินค้า" },
            { label: "Conversion Rate", value: `${conversion.toFixed(2)}%`, detail: "เข้าชม → ชำระแล้ว" },
            { label: "กดซื้อ", value: buyClicks.toLocaleString("th-TH"), detail: `เปิดชำระเงิน ${checkoutOpens}` },
          ].map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-line bg-paper-dim p-5">
              <p className="text-xs text-muted">{metric.label}</p>
              <p className="mt-1 text-lg font-bold text-ink">{metric.value}</p>
              <p className="mt-1 text-xs text-muted">{metric.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-paper p-6">
          <h2 className="text-sm font-semibold text-ink">Conversion Funnel</h2>
          <ConversionFunnel steps={[
            { label: "ดูสินค้า", value: views },
            { label: "กดซื้อ", value: buyClicks },
            { label: "เปิดชำระเงิน", value: checkoutOpens },
            { label: "ชำระแล้ว", value: summary.rangeOrderCount },
          ]} />
        </section>
        <section className="min-w-0 rounded-2xl border border-line bg-paper p-6">
          <h2 className="text-sm font-semibold text-ink">เข้าชม + ชำระแล้ว</h2>
          <div className="mt-6 overflow-x-auto">
            <div className="flex h-40 items-end gap-1" style={{ minWidth: `${Math.max(320, chartDays.length * 12)}px` }}>
              {chartDays.map((day) => (
                <div key={day.key} aria-label={`${day.key}: ${day.views} views, ${day.purchases} paid orders`} className="flex h-full min-w-2 flex-1 items-end gap-px" title={`${day.label} · เข้าชม ${day.views} · ชำระแล้ว ${day.purchases}`}>
                  <div className="flex-1 rounded-t bg-accent/30" style={{ height: `${(day.views / chartMax) * 100}%` }} />
                  <div className="flex-1 rounded-t bg-accent" style={{ height: `${(day.purchases / chartMax) * 100}%` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex gap-4 text-xs text-muted"><span>● เข้าชม</span><span className="text-accent">● ชำระแล้ว</span></div>
          {views === 0 && <p className="mt-4 text-xs text-muted">ยังไม่มีข้อมูลการเข้าชมในช่วงนี้</p>}
        </section>
      </div>
      <p className="mt-4 text-xs text-muted">สถิติใช้เวลาไทย · ยอดขายและการซื้อสำเร็จนับเฉพาะออเดอร์ที่ชำระแล้ว ไม่รวมรายการคืนเงิน</p>

      <section id="orders" aria-labelledby="incoming-orders" className="mt-10 scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="incoming-orders" className="text-lg font-bold text-ink">ออเดอร์ที่ได้รับ</h2>
          <span className="text-xs text-muted">ทั้งหมด {orders.length.toLocaleString("th-TH")} ออเดอร์ · ทุกช่วงเวลา</span>
        </div>
        <p className="mt-2 text-xs text-muted">รายการชำระผ่าน Stripe จะปรากฏเมื่อระบบยืนยันการชำระเงิน</p>
        <div className="mt-4"><OrderTabs orders={orders} /></div>
      </section>
    </div>
  );
}
