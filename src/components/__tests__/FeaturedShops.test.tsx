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
});
