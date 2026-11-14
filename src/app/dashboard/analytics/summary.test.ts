import { describe, expect, it } from "vitest";
import { normalizeAnalyticsRange, summarizeOrders } from "./summary";

const now = new Date("2026-11-12T05:00:00Z");
const order = (status: string, price_cents: number, created_at: string) => ({ status, price_cents, created_at });

describe("analytics ranges", () => {
  it.each([undefined, "", "0", "-7", "NaN", "1000000", "07", ["7", "90"]].map((value) => ({ value })))("defaults invalid range $value to a bounded 30 days", ({ value }) => {
    expect(normalizeAnalyticsRange(value)).toBe(30);
  });
  it.each(["7", "30", "90"])("accepts the supported %s-day range", (value) => {
    expect(normalizeAnalyticsRange(value)).toBe(Number(value));
  });
});

describe("seller revenue", () => {
  it("excludes pending, refunded and failed orders from every income and purchase figure", () => {
    const rows = [
      order("paid", 10000, "2026-11-02T10:00:00Z"),
      order("paid", 20000, "2026-11-10T10:00:00Z"),
      order("pending", 30000, "2026-11-10T10:00:00Z"),
      order("refunded", 40000, "2026-11-10T10:00:00Z"),
      order("failed", 50000, "2026-11-10T10:00:00Z"),
    ];
    const summary = summarizeOrders(rows, 7, now);
    expect(summary.totalSalesCents).toBe(30000);
    expect(summary.monthSalesCents).toBe(30000);
    expect(summary.monthOrderCount).toBe(2);
    expect(summary.monthEstimatedNetCents).toBe(28500);
    expect(summary.rangeSalesCents).toBe(20000);
    expect(summary.rangeOrderCount).toBe(1);
    expect(summary.estimatedMaturedCents).toBe(10000);
    expect(summary.estimatedGuaranteeCents).toBe(20000);
    expect(summary.salesDays.find((day) => day.key === "2026-11-10")?.total).toBe(20000);
    expect(summary.purchasesByDay["2026-11-10"]).toBe(1);
    expect(rows).toHaveLength(5);
  });

  it("uses Bangkok midnight for range and month boundaries", () => {
    const summary = summarizeOrders([
      order("paid", 100, "2026-10-31T16:59:59Z"),
      order("paid", 200, "2026-10-31T17:00:00Z"),
      order("paid", 400, "2026-11-05T16:59:59Z"),
      order("paid", 800, "2026-11-05T17:00:00Z"),
    ], 7, now);
    expect(summary.monthSalesCents).toBe(1400);
    expect(summary.rangeSalesCents).toBe(800);
    expect(summary.rangeOrderCount).toBe(1);
    expect(summary.salesDays).toHaveLength(7);
    expect(summary.salesDays[0]).toMatchObject({ key: "2026-11-06", total: 800 });
  });

  it("treats an order exactly seven days old as past the guarantee and ignores future dates", () => {
    const summary = summarizeOrders([
      order("paid", 10000, "2026-11-05T05:00:00Z"),
      order("paid", 20000, "2026-11-05T05:00:01Z"),
      order("paid", 50000, "2026-11-13T05:00:00Z"),
    ], 30, now);
    expect(summary.totalSalesCents).toBe(30000);
    expect(summary.estimatedMaturedCents).toBe(10000);
    expect(summary.estimatedGuaranteeCents).toBe(20000);
  });

  it("returns zero figures and seven empty sales days for a new shop", () => {
    const summary = summarizeOrders([], 90, now);
    expect(summary.monthSalesCents).toBe(0);
    expect(summary.rangeOrderCount).toBe(0);
    expect(summary.salesDays.map((day) => day.total)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
