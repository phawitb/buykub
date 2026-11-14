import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShopShell } from "./ShopShell";

describe("ShopShell", () => {
  it("fills the available storefront width", () => {
    render(
      <ShopShell>
        <h1>ร้านทดสอบ</h1>
      </ShopShell>,
    );

    const main = screen.getByRole("main");
    const canvas = screen.getByTestId("shop-canvas");
    expect(main).toHaveClass("py-0");
    expect(canvas).toHaveClass("w-full");
    expect(canvas).not.toHaveClass("max-w-[640px]");
    expect(canvas).not.toHaveClass("sm:rounded-[28px]");
    expect(canvas).not.toHaveClass(
      "sm:shadow-[0_20px_70px_rgba(24,24,27,0.08)]",
    );
  });
});
