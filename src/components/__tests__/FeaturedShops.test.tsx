import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeaturedShops } from "@/components/FeaturedShops";

describe("FeaturedShops", () => {
  it("matches PIXZA's six-card showcase without claiming demo shops are live", () => {
    render(<FeaturedShops />);

    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(
      screen.getAllByRole("link", { name: /สร้างร้านแบบ/ }),
    ).toHaveLength(6);
    expect(
      screen.getByRole("heading", {
        name: "ตัวอย่างร้านที่สร้างได้บน Framelink",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("ร้านจริงที่เปิดอยู่บน Framelink")).not.toBeInTheDocument();
  });

  it("uses responsive CSS-only gradient covers and overlapping avatars", () => {
    render(<FeaturedShops />);

    expect(screen.getByTestId("featured-shop-grid")).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-2",
      "lg:grid-cols-3",
    );
    expect(screen.getAllByTestId("shop-cover")).toHaveLength(6);
    expect(screen.getAllByTestId("shop-avatar")).toHaveLength(6);
    expect(screen.getAllByTestId("shop-motif")).toHaveLength(6);
    expect(document.querySelectorAll("img")).toHaveLength(0);

    for (const link of screen.getAllByRole("link", {
      name: /สร้างร้านแบบ/,
    })) {
      expect(link).toHaveAttribute("href", "/login?next=%2Fdashboard");
    }
  });
});
