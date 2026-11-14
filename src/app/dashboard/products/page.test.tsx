import { describe, expect, it, vi, beforeEach } from "vitest";
import ProductsPage from "./page";

const mocks = vi.hoisted(() => ({ getSellerContext: vi.fn(), redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }) }));
vi.mock("@/lib/supabase/seller-context", () => ({ getSellerContext: mocks.getSellerContext }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./MyShop", () => ({ MyShop: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSellerContext.mockResolvedValue({ user: { id: "buyer" }, shop: null, supabase: { from: vi.fn() } });
});

describe("shop entry for a buyer", () => {
  it("sends an account without a shop to its purchases by default", async () => {
    await expect(ProductsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/learn");
  });
  it("only opens creation when the buyer chooses to open a shop", async () => {
    const page = await ProductsPage({ searchParams: Promise.resolve({ create: "1" }) });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(page.props.initial).toBeNull();
    expect(page.props.userId).toBe("buyer");
  });
  it("preserves a chosen shop link from the landing page", async () => {
    const page = await ProductsPage({ searchParams: Promise.resolve({ slug: "my-new-shop" }) });
    expect(page.props.desiredSlug).toBe("my-new-shop");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
