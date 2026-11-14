import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductDetailPage from "./page";

const mocks = vi.hoisted(() => ({
  getPublicShop: vi.fn(),
  getPublicProduct: vi.fn(),
  rpc: vi.fn(),
  purchase: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/lib/storefront/catalog", () => ({ getPublicShop: mocks.getPublicShop, getPublicProduct: mocks.getPublicProduct }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/features/analytics/ProductViewTracker", () => ({ ProductViewTracker: () => null }));
vi.mock("@/features/storefront/ProductGallery", () => ({ ProductGallery: () => null }));
vi.mock("@/features/storefront/ProductDetailShell", () => ({ ProductDetailShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("./ProductPurchase", () => ({ ProductPurchase: (props: unknown) => { mocks.purchase(props); return null; } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublicShop.mockResolvedValue({ id: "shop-1", slug: "demo", name: "Demo shop", avatar_url: null });
  mocks.rpc.mockResolvedValue({ data: 3 });
});

describe("product detail category", () => {
  it.each([
    ["course", "Course"],
    ["file", "File"],
    ["key", "File"],
  ] as const)("shows %s by delivery while preserving purchase behavior", async (deliveryType, label) => {
    mocks.getPublicProduct.mockResolvedValue({
      id: "product-1", name: "My product", category: "OTHER", delivery_type: deliveryType,
      price_cents: 9900, compare_price_cents: null, images: [], images_v2: [], faq: [], highlights: [],
    });

    render(await ProductDetailPage({ params: Promise.resolve({ slug: "demo", productSlug: "my-product" }) }));

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText("OTHER")).not.toBeInTheDocument();
    expect(mocks.purchase).toHaveBeenCalledWith(expect.objectContaining({ product: expect.objectContaining({ deliveryType, availableStock: deliveryType === "key" ? 3 : undefined }) }));
    if (deliveryType === "key") {
      expect(mocks.rpc).toHaveBeenCalledWith("product_available_key_count", { p_product_id: "product-1" });
    } else {
      expect(mocks.rpc).not.toHaveBeenCalled();
    }
  });
});

it("shares the public product URL from the product header", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  mocks.getPublicProduct.mockResolvedValue({
    id: "product-1", slug: "my-product", name: "My product", delivery_type: "file",
    price_cents: 9900, images: [], images_v2: [], faq: [], highlights: [],
  });
  render(await ProductDetailPage({ params: Promise.resolve({ slug: "demo", productSlug: "my-product" }) }));
  fireEvent.click(screen.getByRole("button", { name: "แชร์สินค้า" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://buykub.com/demo/my-product"));
});
