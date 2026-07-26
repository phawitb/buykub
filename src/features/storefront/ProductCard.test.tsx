import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductCard } from "@/features/storefront/ProductCard";

const product = {
  name: "E-Book + Audio Book",
  slug: "e-book-audio-book",
  category: "E-BOOK",
  priceCents: 38900,
  comparePriceCents: 54900,
  thumbnailUrl: "https://example.com/cover.webp",
};

describe("ProductCard", () => {
  it("makes the complete product card a detail-page link", () => {
    render(<ProductCard shopSlug="demo-shop" product={product} />);

    expect(
      screen.getByRole("link", { name: "E-Book + Audio Book" }),
    ).toHaveAttribute("href", "/demo-shop/e-book-audio-book");
    expect(screen.getByRole("img", { name: "E-Book + Audio Book" })).toHaveAttribute(
      "src",
      product.thumbnailUrl,
    );
    expect(screen.getByText("E-BOOK")).toBeInTheDocument();
    expect(screen.getByText("฿389")).toBeInTheDocument();
    expect(screen.getByText("฿549")).toHaveClass("line-through");
  });

  it("uses an accessible placeholder when the product has no image", () => {
    render(
      <ProductCard
        shopSlug="demo-shop"
        product={{ ...product, thumbnailUrl: null }}
      />,
    );

    expect(
      screen.getByRole("img", { name: "ยังไม่มีรูปสำหรับ E-Book + Audio Book" }),
    ).toBeInTheDocument();
  });

  it("shows remaining stock and sold-out state for key products", () => {
    const { rerender } = render(
      <ProductCard
        shopSlug="demo-shop"
        product={{
          ...product,
          deliveryType: "key",
          availableStock: 3,
        }}
      />,
    );
    expect(screen.getByText("เหลือ 3 รายการ")).toBeInTheDocument();

    rerender(
      <ProductCard
        shopSlug="demo-shop"
        product={{
          ...product,
          deliveryType: "key",
          availableStock: 0,
        }}
      />,
    );
    expect(screen.getByText("สินค้าหมด")).toBeInTheDocument();
  });
});
