import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]> }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (table: string) => ({ select: () => ({ range: async () => ({ data: state.tables[table] || [], error: null }) }) }) }) }));
import { getPayoutDashboard } from "./service";
beforeEach(() => { state.tables = {}; });
it("does not show free or mock purchases as money awaiting Stripe verification", async () => {
  state.tables.orders = [
    { id: "free", status: "paid", mock: false, price_cents: 0, payment_method: "free" },
    { id: "mock", status: "paid", mock: true, price_cents: 1000, payment_method: "stripe" },
  ];
  const result = await getPayoutDashboard();
  expect(result.eligibleCents).toBe(0);
  expect(result.blockedOrderCount).toBe(0);
  expect(result.blockedReasons).toEqual([]);
});
it("keeps an unverified real payment blocked until Stripe is checked", async () => {
  state.tables.orders = [{ id: "paid", status: "paid", mock: false, price_cents: 1000, payment_method: "stripe" }];
  const result = await getPayoutDashboard();
  expect(result.eligibleCents).toBe(0);
  expect(result.blockedOrderCount).toBe(1);
  expect(result.blockedReasons[0].reason).toBe("ยังไม่ได้ตรวจสอบกับ Stripe");
});
