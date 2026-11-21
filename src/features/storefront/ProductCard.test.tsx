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
  it("shows the whole cover in its own shape instead of cropping it square", () => {
    render(<ProductCard shopSlug="demo-shop" product={product} />);
    const cover = screen.getByRole("img", { name: "E-Book + Audio Book" });
    expect(cover).not.toHaveClass("object-cover");
    expect(cover.parentElement).not.toHaveClass("aspect-square");
  });

  it("makes the complete product card a detail-page link", () => {
    render(<ProductCard shopSlug="demo-shop" product={product} />);

    expect(
      screen.getByRole("link", { name: "E-Book + Audio Book" }),
    ).toHaveAttribute("href", "/demo-shop/e-book-audio-book");
    expect(screen.getByRole("img", { name: "E-Book + Audio Book" })).toHaveAttribute(
      "src",
      product.thumbnailUrl,
    );
    expect(screen.getByText("File")).toBeInTheDocument();
    expect(screen.queryByText("E-BOOK")).not.toBeInTheDocument();
    expect(screen.getByText("฿389")).toBeInTheDocument();
    expect(screen.getByText("฿549")).toHaveClass("line-through");
  });

  it.each([
    ["course", "Course"],
    ["file", "File"],
    ["key", "File"],
  ] as const)("derives the %s badge from delivery, ignoring a stale category", (deliveryType, label) => {
    render(<ProductCard shopSlug="demo-shop" product={{ ...product, category: "OTHER", deliveryType }} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText("OTHER")).not.toBeInTheDocument();
  });

  it.each([
    ["file", "ไฟล์ดิจิทัล"],
    ["course", "คอร์สเรียน"],
    ["key", "คีย์สินค้า"],
  ] as const)("uses an accessible %s illustration when the product has no image", (deliveryType, label) => {
    render(
      <ProductCard
        shopSlug="demo-shop"
        product={{ ...product, thumbnailUrl: null, deliveryType }}
      />,
    );

    expect(
      screen.getByRole("img", { name: `ภาพประกอบ${label}สำหรับ E-Book + Audio Book` }),
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
