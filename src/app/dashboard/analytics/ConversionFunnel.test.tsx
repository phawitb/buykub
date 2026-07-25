import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConversionFunnel } from "./ConversionFunnel";

describe("ConversionFunnel", () => {
  it("shows the conversion percentage between each funnel step", () => {
    render(
      <ConversionFunnel
        steps={[
          { label: "ดูสินค้า", value: 100 },
          { label: "กดซื้อ", value: 40 },
          { label: "เปิดชำระเงิน", value: 20 },
          { label: "ซื้อสำเร็จ", value: 5 },
        ]}
      />,
    );

    expect(screen.getByText("40.0%")).toBeInTheDocument();
    expect(screen.getByText("50.0%")).toBeInTheDocument();
    expect(screen.getByText("25.0%")).toBeInTheDocument();
    expect(screen.getAllByText("↓")).toHaveLength(3);
  });
});
