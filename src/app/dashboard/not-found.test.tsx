import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardNotFound from "./not-found";

describe("DashboardNotFound", () => {
  it("offers useful recovery destinations for missing dashboard records", () => {
    render(<DashboardNotFound />);

    expect(screen.getByRole("heading", { name: "ไม่พบข้อมูลที่ต้องการ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "กลับหน้าหลังร้าน" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "ไปร้านค้าของฉัน" })).toHaveAttribute(
      "href",
      "/dashboard/products",
    );
  });
});
