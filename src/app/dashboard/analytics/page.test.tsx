import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsPage from "./page";

const context = vi.hoisted(() => ({ getSellerContext: vi.fn() }));
vi.mock("@/lib/supabase/seller-context", () => context);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
  useSearchParams: () => new URLSearchParams(),
}));

function fixture(error: Error | null = null) {
  const rows = ["paid", "pending", "refunded", "failed"].map((status, index) => ({
    id: `order-${status}`, buyer_name: "Buyer", buyer_email: "buyer@example.com",
    payment_method: "card", price_cents: (index + 1) * 10000, status,
    created_at: new Date().toISOString(), products: { name: `Product ${status}` },
  }));
  const from = vi.fn((table: string) => {
    const result = table === "orders" ? { data: rows, error } : { data: [], count: 3, error: null };
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query), gte: vi.fn(() => query),
      lte: vi.fn(() => query), order: vi.fn(() => query), range: vi.fn(() => query),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  });
  context.getSellerContext.mockResolvedValue({ supabase: { from }, shop: { id: "owned-shop" } });
  return from;
}

beforeEach(() => vi.clearAllMocks());

describe("unified Analytics", () => {
  it("uses one seller order read for revenue and every incoming-order status", async () => {
    const from = fixture();
    render(await AnalyticsPage({ searchParams: Promise.resolve({ range: "7" }) }));
    const orders = screen.getByRole("region", { name: "ออเดอร์ที่ได้รับ" });
    expect(within(orders).getAllByRole("link")).toHaveLength(4);
    expect(within(orders).getByRole("link", { name: /Product paid/ })).toHaveAttribute("href", "/dashboard/orders/order-paid");
    fireEvent.click(within(orders).getByRole("button", { name: "คืนเงิน" }));
    expect(within(orders).getAllByRole("link")).toHaveLength(1);
    expect(within(orders).getByText("Product refunded")).toBeInTheDocument();
    const overview = screen.getByRole("region", { name: "ภาพรวมเดือนนี้" });
    expect(within(overview).getByText("฿100")).toBeInTheDocument();
    expect(within(overview).getByText("฿95")).toBeInTheDocument();
    expect(from.mock.calls.filter(([table]) => table === "orders")).toHaveLength(1);
    const orderQuery = from.mock.results.find((_, index) => from.mock.calls[index][0] === "orders")?.value;
    expect(orderQuery.eq).toHaveBeenCalledWith("shop_id", "owned-shop");
    expect(screen.getByRole("heading", { name: "ยอดรับเงินโดยประมาณ" })).toBeInTheDocument();
  });

  it("does not show a zero balance when loading orders fails", async () => {
    fixture(new Error("orders unavailable"));
    await expect(AnalyticsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("orders unavailable");
  });

  it("returns buyers without a shop to their purchases", async () => {
    context.getSellerContext.mockResolvedValue({ supabase: {}, shop: null });
    await expect(AnalyticsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/learn");
  });
});
