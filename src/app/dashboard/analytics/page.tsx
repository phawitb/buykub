import { createClient } from "@/lib/supabase/server";
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

  const since = new Date(new Date().getTime() - days * 86400000).toISOString();

  const [{ count: viewCount }, { data: orders }] = await Promise.all([
    supabase
      .from("shop_views")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .gte("created_at", since),
    supabase
      .from("orders")
      .select("price_cents")
      .eq("shop_id", shop.id)
      .gte("created_at", since),
  ]);

  const views = viewCount ?? 0;
  const purchases = orders?.length ?? 0;
  const sales = (orders ?? []).reduce((sum, o) => sum + o.price_cents, 0);
  const conversion = views > 0 ? (purchases / views) * 100 : 0;

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Analytics</h1>
          <p className="mt-1 text-sm text-muted">ดูยอดขายและอัตราการเปลี่ยนเป็นลูกค้าของร้านคุณ</p>
        </div>
        <RangeTabs current={String(days)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-paper-dim p-5">
          <p className="text-xs text-muted">ยอดขาย</p>
          <p className="mt-1 text-lg font-bold text-ink">
            ฿{(sales / 100).toLocaleString("th-TH")}
          </p>
          <p className="mt-0.5 text-xs text-muted">{purchases} ออเดอร์</p>
        </div>
        <div className="rounded-2xl border border-line bg-paper-dim p-5">
          <p className="text-xs text-muted">คนเข้าดูร้าน</p>
          <p className="mt-1 text-lg font-bold text-ink">{views}</p>
          <p className="mt-0.5 text-xs text-muted">page views</p>
        </div>
        <div className="rounded-2xl border border-line bg-paper-dim p-5">
          <p className="text-xs text-muted">Conversion Rate</p>
          <p className="mt-1 text-lg font-bold text-ink">{conversion.toFixed(2)}%</p>
          <p className="mt-0.5 text-xs text-muted">view → ซื้อสำเร็จ</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-paper p-6">
        <p className="text-sm font-semibold text-ink">Conversion Funnel</p>
        <p className="mt-1 text-xs text-muted">จาก view สู่ซื้อ · {conversion.toFixed(2)}%</p>

        <div className="mt-5 space-y-4">
          <FunnelStep n="01" label="เข้าดูร้าน" value={views} of={views} />
          <FunnelStep n="02" label="ซื้อสำเร็จ" value={purchases} of={views} />
        </div>

        {views === 0 && (
          <p className="mt-6 text-center text-sm text-muted">
            ยังไม่มีข้อมูลในช่วงนี้ — จะขึ้นเมื่อมีคนเข้าดูร้านของคุณ
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-muted">
        เวอร์ชันนี้ใช้ฟันเนล 2 ขั้น (เข้าดู → ซื้อสำเร็จ) แบบย่อ เพราะยังไม่มีหน้าชำระเงินจริงให้วัด
        ขั้นกลางเพิ่มเติม
      </p>
    </div>
  );
}

function FunnelStep({ n, label, value, of }: { n: string; label: string; value: number; of: number }) {
  const pct = of > 0 ? (value / of) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">{n}</span>
        <span className="font-medium text-ink">{label}</span>
        <span className="font-bold text-ink">{value}</span>
      </div>
      <div className="mt-1.5 h-2 w-full rounded-full bg-paper-dim">
        <div className="h-2 rounded-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
