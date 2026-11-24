import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
const rows = vi.hoisted(() => ({ data: [] as unknown[] }));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const query = { select: () => query, eq: () => query, then: (resolve: (v: unknown) => void) => resolve({ data: rows.data, error: null }) };
    return { from: () => query };
  },
}));

const { countBuyers, getProductBuyerCount, OFFLINE_BUYERS } = await import("./buyer-count");

describe("countBuyers", () => {
  it("counts each person once, by account, then by email", () => {
    expect(countBuyers([
      { buyer_user_id: "u1", buyer_email: "a@example.com" },
      { buyer_user_id: "u1", buyer_email: "a@example.com" },
      { buyer_user_id: null, buyer_email: "B@example.com " },
      { buyer_user_id: null, buyer_email: "b@example.com" },
      { buyer_user_id: null, buyer_email: null },
    ])).toBe(3);
  });
});

describe("getProductBuyerCount", () => {
  it("adds buyers the seller sold to outside BUYKUB", async () => {
    rows.data = [{ buyer_user_id: "u1", buyer_email: null }, { buyer_user_id: "u2", buyer_email: null }];
    const [productId, offline] = Object.entries(OFFLINE_BUYERS)[0];
    expect(await getProductBuyerCount(productId)).toBe(offline + 2);
    expect(await getProductBuyerCount("other-product")).toBe(2);
  });
});
