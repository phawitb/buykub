import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductDetailPage from "./page";

const mocks = vi.hoisted(() => ({
  getPublicShop: vi.fn(),
  getPublicProduct: vi.fn(),
  rpc: vi.fn(),
  purchase: vi.fn(),
  examSummary: vi.fn(),
  previews: vi.fn(async () => [] as unknown[]),
}));

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/lib/storefront/catalog", () => ({ getPublicShop: mocks.getPublicShop, getPublicProduct: mocks.getPublicProduct }));
vi.mock("@/lib/storefront/previews", () => ({ getPublicPreviewImages: mocks.previews }));
vi.mock("@/lib/storefront/exam-summary", () => ({ getPublicExamSummary: mocks.examSummary }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/components/DashboardShortcut", () => ({ DashboardShortcut: () => null }));
vi.mock("@/features/analytics/ProductViewTracker", () => ({ ProductViewTracker: () => null }));
vi.mock("@/features/storefront/ProductGallery", () => ({ ProductGallery: () => null }));
vi.mock("@/features/storefront/ProductDetailShell", () => ({ ProductDetailShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("./ProductPurchase", () => ({ ProductPurchase: (props: unknown) => { mocks.purchase(props); return null; } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublicShop.mockResolvedValue({ id: "shop-1", slug: "demo", name: "Demo shop", avatar_url: null });
  mocks.rpc.mockResolvedValue({ data: 3 });
  mocks.examSummary.mockResolvedValue(null);
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

it("lists what an exam-prep course contains, from its public summary", async () => {
  mocks.getPublicProduct.mockResolvedValue({
    id: "product-1", name: "Exam course", delivery_type: "course", course_access_days: 30,
    price_cents: 9900, images: [], images_v2: [], faq: [], highlights: [],
  });
  mocks.examSummary.mockResolvedValue({
    format: "exam-prep", version: 1, id: "demo", title: "Demo", days: 7, questions: 300, practice: 150,
    mocks: 1, mockQuestions: 150, mockMinutes: 180, chapters: 39,
    subjects: [{ key: "math", code: "M", name: "คณิต", short: "M", questions: 40, perSet: 20, chapters: 6 }],
    parts: [{ name: "ภาคทั่วไป", max: 50, pass: 0.6 }],
  });
  render(await ProductDetailPage({ params: Promise.resolve({ slug: "demo", productSlug: "exam" }) }));
  expect(mocks.examSummary).toHaveBeenCalledWith("product-1");
  expect(screen.getByText("7 วัน")).toBeInTheDocument();
  expect(screen.getByText("300 ข้อ")).toBeInTheDocument();
  expect(screen.getByText(/ภาคทั่วไป 30\/50 ข้อ/)).toBeInTheDocument();
  expect(screen.getByText(/เข้าเรียนได้ 30 วันนับจากชำระเงิน/)).toBeInTheDocument();
});

it("shows the seller's sample images under what the buyer gets, each whole", async () => {
  mocks.getPublicProduct.mockResolvedValue({
    id: "product-1", name: "Sheet", delivery_type: "file", price_cents: 9900,
    images: [], images_v2: [], faq: [], highlights: ["สรุป 6 วิชา"],
  });
  mocks.previews.mockResolvedValueOnce([
    { id: "a", publicUrl: "https://cdn.example/a.png", width: 800, height: 1200 },
    { id: "b", publicUrl: "https://cdn.example/b.png", width: 1200, height: 800 },
  ]);
  render(await ProductDetailPage({ params: Promise.resolve({ slug: "demo", productSlug: "sheet" }) }));
  expect(mocks.previews).toHaveBeenCalledWith("product-1");
  const section = screen.getByRole("region", { name: "ตัวอย่าง" });
  const images = section.querySelectorAll("img");
  expect([...images].map((image) => image.getAttribute("src"))).toEqual(["https://cdn.example/a.png", "https://cdn.example/b.png"]);
  expect(images[0]).toHaveClass("object-contain");
});
