import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductGrid } from "./ProductGrid";

describe("ProductGrid", () => {
  it("uses one column on mobile and two columns from the desktop breakpoint", () => {
    render(
      <ProductGrid>
        <article>สินค้า</article>
      </ProductGrid>,
    );

    const grid = screen.getByRole("list", { name: "สินค้าดิจิทัล" });
    expect(grid).toHaveClass("grid-cols-1");
    expect(grid).toHaveClass("sm:grid-cols-2");
    expect(grid).toHaveClass("sm:gap-x-[14px]");
  });
});
