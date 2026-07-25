import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OverviewCards } from "./OverviewCards";

describe("OverviewCards", () => {
  it("separates sales, orders, and products with the PIXZA action placement", () => {
    render(
      <OverviewCards
        monthLabel="กรกฎาคม 2569"
        grossCents={12400}
        netCents={11408}
        orderCount={1}
        productCount={1}
      />,
    );

    expect(screen.getByText("ยอดขายเดือนนี้ · กรกฎาคม 2569")).toBeInTheDocument();
    expect(screen.getByText("ออเดอร์เดือนนี้")).toBeInTheDocument();
    expect(screen.getByText("สินค้าที่เปิดขาย")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ สร้างสินค้าใหม่" })).toHaveAttribute(
      "href",
      "/dashboard/products/new",
    );
  });
});
