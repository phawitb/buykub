import { render, screen } from "@testing-library/react";
import { vi, describe, expect, it } from "vitest";
import { DashboardNavigation } from "./DashboardNavigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/bookings",
}));

describe("DashboardNavigation", () => {
  it("uses the same task labels and active-page behavior across the dashboard", () => {
    render(<DashboardNavigation />);

    expect(
      screen.getByRole("link", { name: "จองบริการ" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute(
      "href",
      "/dashboard/analytics",
    );
    expect(screen.queryByRole("link", { name: "จอง" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "สถิติ" })).not.toBeInTheDocument();
  });
});
