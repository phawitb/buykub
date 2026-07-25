import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductDetailShell } from "./ProductDetailShell";

describe("ProductDetailShell", () => {
  it("uses PIXZA's centered 640px edge-to-edge sales-page column", () => {
    render(
      <ProductDetailShell>
        <p>รายละเอียดสินค้า</p>
      </ProductDetailShell>,
    );

    const article = screen.getByRole("article");
    expect(article).toHaveClass("max-w-[640px]");
    expect(article).not.toHaveClass("rounded-[28px]");
    expect(article).not.toHaveClass("shadow-[0_20px_70px_rgba(24,24,27,0.08)]");
    expect(screen.getByRole("main")).toHaveClass("py-0");
  });
});
