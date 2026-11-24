import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const { countBuyers } = await import("./buyer-count");

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
