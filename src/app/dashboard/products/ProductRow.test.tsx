import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductRow } from "./ProductRow";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

const product = {
  id: "product-123",
  shop_id: "shop-123",
  name: "Digital Product",
  slug: "demo-product",
  description: "คำอธิบายสินค้า",
  price_cents: 38900,
  compare_price_cents: 54900,
  category: "E-BOOK",
  published: true,
  thumbnailUrl: "https://example.com/cover.webp",
};

describe("ProductRow", () => {
  it("offers preview and edit navigation for the selected product", () => {
    render(<ProductRow product={product} shopSlug="demo-shop" />);

    expect(screen.getByRole("img", { name: "Digital Product" })).toHaveAttribute(
      "src",
      product.thumbnailUrl,
    );
    expect(screen.getByRole("link", { name: "แก้ไข" })).toHaveAttribute(
      "href",
      "/dashboard/products/product-123/edit",
    );
    expect(screen.getByRole("link", { name: "ดูหน้าขาย" })).toHaveAttribute(
      "href",
      "/demo-shop/demo-product",
    );
    expect(
      screen.getByRole("button", { name: "ยกเลิกเผยแพร่" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ลบสินค้า" })).toBeInTheDocument();
  });
});
