import { createClient } from "@/lib/supabase/server";
import { bangkokDateKey, recentBangkokDays } from "@/lib/bangkok-date";
import { ConversionFunnel } from "./ConversionFunnel";
import { RangeTabs } from "./RangeTabs";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const days = Number(range ?? "30");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user!.id)
    .maybeSingle();

  if (!shop) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-bold text-ink">Analytics</h1>
        <p className="mt-3 text-sm text-ink-soft">ตั้งชื่อร้านก่อนดูข้อมูล Analytics</p>
      </div>
    );
  }

  const chartCalendarDays = recentBangkokDays(days);
  const since = `${chartCalendarDays[0].key}T00:00:00+07:00`;

  const [{ data: events }, { data: orders }] = await Promise.all([
    supabase
      .from("analytics_events")
      .select("event_type, created_at")
      .eq("shop_id", shop.id)
      .gte("created_at", since),
    supabase
      .from("orders")
      .select("price_cents")
      .eq("shop_id", shop.id)
      .gte("created_at", since),
  ]);

  const eventList = events ?? [];
  const views = eventList.filter((event) => event.event_type === "view_product").length;
  const buyClicks = eventList.filter((event) => event.event_type === "click_buy").length;
  const checkoutOpens = eventList.filter(
    (event) => event.event_type === "open_checkout",
  ).length;
  const trackedPurchases = eventList.filter(
    (event) => event.event_type === "purchase",
  ).length;
  const purchases = orders?.length ?? trackedPurchases;
  const sales = (orders ?? []).reduce((sum, o) => sum + o.price_cents, 0);
  const conversion = views > 0 ? (purchases / views) * 100 : 0;
  const chartDays = chartCalendarDays.map((day) => {
    return {
      key: day.key,
      label: day.date.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
      views: eventList.filter(
        (event) =>
          event.event_type === "view_product" &&
          bangkokDateKey(new Date(event.created_at)) === day.key,
      ).length,
      purchases: eventList.filter(
        (event) =>
          event.event_type === "purchase" &&
          bangkokDateKey(new Date(event.created_at)) === day.key,
      ).length,
    };
  });
  const chartMax = Math.max(
    1,
    ...chartDays.flatMap((day) => [day.views, day.purchases]),
  );

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Analytics</h1>
          <p className="mt-1 text-sm text-muted">
            ดู funnel + conversion rate ของร้านคุณ
          </p>
        </div>
        <RangeTabs current={String(days)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-line bg-paper-dim p-5">
          <p className="text-xs text-muted">ยอดขาย</p>
          <p className="mt-1 text-lg font-bold text-ink">
            ฿{(sales / 100).toLocaleString("th-TH")}
          </p>
          <p className="mt-0.5 text-xs text-muted">{purchases} ออเดอร์</p>
        </div>
        <div className="rounded-2xl border border-line bg-paper-dim p-5">
          <p className="text-xs text-muted">คนดูสินค้า</p>
          <p className="mt-1 text-lg font-bold text-ink">{views}</p>
          <p className="mt-0.5 text-xs text-muted">unique views (30 นาที)</p>
        </div>
        <div className="rounded-2xl border border-line bg-paper-dim p-5">
          <p className="text-xs text-muted">Conversion Rate</p>
          <p className="mt-1 text-lg font-bold text-ink">{conversion.toFixed(2)}%</p>
          <p className="mt-0.5 text-xs text-muted">view → ซื้อสำเร็จ</p>
        </div>
        <div className="rounded-2xl border border-line bg-paper-dim p-5">
          <p className="text-xs text-muted">กดซื้อ</p>
          <p className="mt-1 text-lg font-bold text-ink">{buyClicks}</p>
          <p className="mt-0.5 text-xs text-muted">
            เปิดชำระเงิน {checkoutOpens}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-paper p-6">
        <p className="text-sm font-semibold text-ink">Conversion Funnel</p>
        <p className="mt-1 text-xs text-muted">จาก view สู่ซื้อ · {conversion.toFixed(2)}%</p>

        <ConversionFunnel
          steps={[
            { label: "ดูสินค้า", value: views },
            { label: "กดซื้อ", value: buyClicks },
            { label: "เปิดชำระเงิน", value: checkoutOpens },
            { label: "ซื้อสำเร็จ", value: purchases },
          ]}
        />

        {views === 0 && (
          <p className="mt-6 text-center text-sm text-muted">
            ยังไม่มีข้อมูลในช่วงนี้ — จะขึ้นเมื่อมีคนเข้าดูร้านของคุณ
          </p>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-paper p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Views + Purchases</h2>
          <span className="text-xs text-muted">{days} วัน</span>
        </div>
        <div className="mt-6 overflow-x-auto">
          <div
            className="flex h-40 min-w-max items-end gap-1"
            style={{ minWidth: `${Math.max(640, chartDays.length * 18)}px` }}
          >
            {chartDays.map((day) => (
              <div
                key={day.key}
                aria-label={`${day.key}: ${day.views} views, ${day.purchases} purchases`}
                className="group flex h-full min-w-3 flex-1 items-end gap-px"
                title={`${day.label} · ${day.views} views · ${day.purchases} purchases`}
              >
                <div
                  className="min-h-0 flex-1 rounded-t bg-accent/30"
                  style={{ height: `${(day.views / chartMax) * 100}%` }}
                />
                <div
                  className="min-h-0 flex-1 rounded-t bg-accent"
                  style={{ height: `${(day.purchases / chartMax) * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex gap-4 text-[11px] text-muted">
          <span>● views</span>
          <span className="text-accent">● purchases</span>
        </div>
        {views === 0 && (
          <div className="mt-5 text-center">
            <p className="text-sm font-medium text-ink">
              ยังไม่มีข้อมูลสินค้าในช่วงนี้
            </p>
            <p className="mt-1 text-xs text-muted">
              จะขึ้นเมื่อมีคนเข้าดูสินค้าของคุณ
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-muted">
        Event dedup 30 นาทีต่อผู้เข้าชมและประเภท event · ระบบชำระเงินยังเป็น
        mockup ตามที่กำหนด
      </p>
    </div>
  );
}
