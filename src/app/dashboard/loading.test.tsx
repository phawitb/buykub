import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardLoading from "./loading";

describe("DashboardLoading", () => {
  it("announces route loading and reserves dashboard card geometry", () => {
    render(<DashboardLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("กำลังโหลดข้อมูลหลังร้าน");
    expect(screen.getAllByTestId("dashboard-card-skeleton")).toHaveLength(4);
  });
});
