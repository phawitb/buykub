import { bangkokDateKey, recentBangkokDays, startOfBangkokMonth } from "@/lib/bangkok-date";

export type AnalyticsRange = 7 | 30 | 90;
type OrderAmount = { status: string; price_cents: number; created_at: string };

export function normalizeAnalyticsRange(value: string | string[] | undefined): AnalyticsRange {
  return value === "7" ? 7 : value === "90" ? 90 : 30;
}

export function summarizeOrders(orders: readonly OrderAmount[], days: AnalyticsRange, now = new Date()) {
  const monthStart = new Date(startOfBangkokMonth(now)).getTime();
  const rangeStart = new Date(`${recentBangkokDays(days, now)[0].key}T00:00:00+07:00`).getTime();
  const guaranteeCutoff = now.getTime() - 7 * 86400000;
  const totalsByDay: Record<string, number> = {};
  const purchasesByDay: Record<string, number> = {};
  let totalSalesCents = 0;
  let monthSalesCents = 0;
  let monthOrderCount = 0;
  let rangeSalesCents = 0;
  let rangeOrderCount = 0;
  let estimatedMaturedCents = 0;
  let estimatedGuaranteeCents = 0;

  for (const order of orders) {
    const timestamp = new Date(order.created_at).getTime();
    if (order.status !== "paid" || !Number.isFinite(timestamp) || timestamp > now.getTime()) continue;
    totalSalesCents += order.price_cents;
    if (timestamp >= monthStart) {
      monthSalesCents += order.price_cents;
      monthOrderCount += 1;
    }
    if (timestamp >= rangeStart) {
      rangeSalesCents += order.price_cents;
      rangeOrderCount += 1;
    }
    if (timestamp <= guaranteeCutoff) estimatedMaturedCents += order.price_cents;
    else estimatedGuaranteeCents += order.price_cents;
    const key = bangkokDateKey(new Date(timestamp));
    totalsByDay[key] = (totalsByDay[key] ?? 0) + order.price_cents;
    purchasesByDay[key] = (purchasesByDay[key] ?? 0) + 1;
  }

  return {
    totalSalesCents,
    monthSalesCents,
    monthOrderCount,
    monthEstimatedNetCents: Math.round(monthSalesCents * 0.95),
    rangeSalesCents,
    rangeOrderCount,
    estimatedMaturedCents,
    estimatedGuaranteeCents,
    salesDays: recentBangkokDays(7, now).map(({ key, label }) => ({ key, label, total: totalsByDay[key] ?? 0 })),
    purchasesByDay,
  };
}
