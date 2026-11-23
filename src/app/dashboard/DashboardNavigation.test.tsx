import { render, screen } from "@testing-library/react";
import { vi, describe, expect, it } from "vitest";
import { DashboardNavigation } from "./DashboardNavigation";

const route = vi.hoisted(() => ({ pathname: "/learn" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}));

describe("DashboardNavigation", () => {
  it("uses the same task labels and active-page behavior across the dashboard", () => {
    render(<DashboardNavigation hasShop />);

    expect(
      screen.getByRole("link", { name: "รายการที่สั่งซื้อ" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute(
      "href",
      "/dashboard/analytics",
    );
    expect(screen.queryByRole("link", { name: "จองบริการ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "สถิติ" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "ร้านค้าของฉัน" })).toHaveAttribute("href", "/dashboard/products");
    expect(screen.queryByRole("link", { name: "หน้าแรก" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ออเดอร์" })).not.toBeInTheDocument();
  });
  it("keeps Analytics active when reading an incoming order", () => {
    route.pathname = "/dashboard/orders/order-1";
    render(<DashboardNavigation mobile hasShop />);
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute("aria-current", "page");
  });
});

it.each([false, true])("shows admin only when server grants access (mobile=%s)", (mobile) => {
  route.pathname = "/dashboard/admin";
  const { rerender } = render(<DashboardNavigation hasShop mobile={mobile} />);
  expect(screen.queryByRole("link", { name: "แอดมิน" })).not.toBeInTheDocument();
  rerender(<DashboardNavigation hasShop mobile={mobile} isAdmin />);
  expect(screen.getByRole("link", { name: "แอดมิน" })).toHaveAttribute("href", "/dashboard/admin");
  expect(screen.getByRole("link", { name: "แอดมิน" })).toHaveAttribute("aria-current", "page");
});

for (const mobile of [false, true]) {
  it(`shows only purchases and an explicit open-shop action for buyers (mobile=${mobile})`, () => {
    route.pathname = "/learn";
    render(<DashboardNavigation mobile={mobile} hasShop={false} />);
    expect(screen.getByRole("link", { name: "รายการที่สั่งซื้อ" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "เปิดร้าน" })).toHaveAttribute("href", "/dashboard/products?create=1");
    expect(screen.queryByRole("link", { name: "ร้านค้าของฉัน" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Analytics" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ตั้งค่า" })).not.toBeInTheDocument();
  });
}

it.each([false, true])("highlights only the referral tab on /learn/affiliate (hasShop=%s)", (hasShop) => {
  route.pathname = "/learn/affiliate";
  render(<DashboardNavigation hasShop={hasShop} />);
  expect(screen.getByRole("link", { name: "รายได้จากลิงก์แนะนำ" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "รายการที่สั่งซื้อ" })).not.toHaveAttribute("aria-current");
});
