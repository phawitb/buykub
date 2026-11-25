import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rows: {} as Record<string, unknown>, products: vi.fn(), summary: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ from: (table: string) => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: m.rows[table] ?? null, error: null }) }; return q; } }) }));
vi.mock("@/lib/storefront/catalog", () => ({ getPublicProducts: m.products }));
vi.mock("@/lib/storefront/exam-summary", () => ({ getPublicExamSummary: m.summary }));
import { loadClassroomUpsell } from "../upsell";

const product = (id: string, price: number) => ({ id, slug: id, name: id, price_cents: price, compare_price_cents: null, images: [], images_v2: [{ publicUrl: `https://cdn/${id}.png` }] });
beforeEach(() => {
  m.rows = { products: { shop_id: "shop", price_cents: 0 }, shops: { slug: "mysheet", name: "ร้านชีสส์" } };
  m.products.mockResolvedValue([product("c30", 18900), product("free", 0), product("full", 5900), product("other-free", 0)]);
  m.summary.mockImplementation(async (id: string) => id === "full" ? { mode: "drill", mocks: 4 } : id === "c30" ? { mocks: 4 } : null);
});
it("advertises the shop's paid products with the drill course's full version first", async () => {
  const upsell = await loadClassroomUpsell("free");
  expect(upsell?.upgrade?.href).toBe("/mysheet/full");
  expect(upsell?.items.map(item => item.id)).toEqual(["full", "c30"]);
  expect(upsell?.items[1].cover).toBe("https://cdn/c30.png");
});
it("shows nothing in a paid classroom", async () => {
  m.rows.products = { shop_id: "shop", price_cents: 18900 };
  expect(await loadClassroomUpsell("c30")).toBeNull();
});
it("hides the ad rather than the classroom when the catalogue fails", async () => {
  m.products.mockRejectedValue(new Error("down"));
  expect(await loadClassroomUpsell("free")).toBeNull();
});
