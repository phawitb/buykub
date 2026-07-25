import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SalesChart } from "./SalesChart";

describe("SalesChart", () => {
  it("shows the baht total above every daily bar like PIXZA", () => {
    render(
      <SalesChart
        days={[
          { key: "2026-07-24", label: "ศ.", total: 0 },
          { key: "2026-07-25", label: "ส.", total: 12_400 },
        ]}
      />,
    );

    expect(screen.getByText("฿0")).toBeInTheDocument();
    expect(screen.getByText("฿124")).toBeInTheDocument();
    expect(screen.getByText("ศ.")).toBeInTheDocument();
    expect(screen.getByText("ส.")).toBeInTheDocument();
  });
});
