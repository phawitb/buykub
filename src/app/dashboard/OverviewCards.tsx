import Link from "next/link";

function baht(cents: number) {
  return `฿${(cents / 100).toLocaleString("th-TH")}`;
}

export function OverviewCards({
  monthLabel,
  grossCents,
  netCents,
  orderCount,
  productCount,
}: {
  monthLabel: string;
  grossCents: number;
  netCents: number;
  orderCount: number;
  productCount: number;
}) {
  const averageCents =
    orderCount > 0 ? Math.round(grossCents / orderCount) : 0;

  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <section className="col-span-2 rounded-2xl border border-line bg-paper p-5 sm:p-6">
        <p className="text-xs text-muted">ยอดขายเดือนนี้ · {monthLabel}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-ink">
          {baht(grossCents)}
        </p>
        <p className="mt-4 border-t border-line pt-4 text-xs text-muted">
          รายได้สุทธิหลังหักค่าธรรมเนียม{" "}
          <span className="font-semibold text-emerald-700">
            {baht(netCents)}
          </span>
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <p className="text-xs text-muted">ออเดอร์เดือนนี้</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-ink">
          {orderCount.toLocaleString("th-TH")}
        </p>
        <p className="mt-4 text-[11px] leading-5 text-muted">
          เฉลี่ย {baht(averageCents)} / ออเดอร์
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <p className="text-xs text-muted">สินค้าที่เปิดขาย</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-ink">
          {productCount.toLocaleString("th-TH")}
        </p>
        <Link
          href="/dashboard/products/new"
          className="mt-4 inline-block text-[11px] font-semibold text-accent hover:text-accent-hover"
        >
          + สร้างสินค้าใหม่
        </Link>
      </section>
    </div>
  );
}
