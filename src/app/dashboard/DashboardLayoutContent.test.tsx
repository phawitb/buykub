import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardLayoutContent } from "./DashboardLayoutContent";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/products" }));

vi.mock("./DashboardNavigation", () => ({
  DashboardNavigation: ({ mobile, hasShop }: { mobile?: boolean; hasShop: boolean }) => (
    <nav aria-label={mobile ? "เมนูมือถือ" : "เมนูหลัก"} data-has-shop={String(hasShop)} />
  ),
}));

vi.mock("./SignOutButton", () => ({
  SignOutButton: () => <button type="button">ออกจากระบบ</button>,
}));

describe("DashboardLayoutContent", () => {
  it("keeps shop navigation without subscription upgrade UI", () => {
    render(
      <DashboardLayoutContent
        user={{ email: "owner@example.com", fullName: "Owner", avatarUrl: null }}
        shop={{ name: "ร้านตัวอย่าง", slug: "example", avatarUrl: null }}
      >
        <p>เนื้อหา</p>
      </DashboardLayoutContent>,
    );

    expect(screen.getByText("ร้านตัวอย่าง")).toBeInTheDocument();
    expect(screen.getByText("buykub.com/example")).toBeInTheDocument();
    expect(screen.getByText("เนื้อหา")).toBeInTheDocument();
    for (const logo of screen.getAllByRole("link", { name: "BUYKUB" })) {
      expect(logo).toHaveAttribute("href", "/");
    }
    expect(
      screen.queryByRole("link", { name: /อัปเกรด/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Free")).not.toBeInTheDocument();
    expect(screen.queryByText(/watermark/i)).not.toBeInTheDocument();
  });
});

it("uses the public landing as the logo destination for an account without a shop", () => {
  render(<DashboardLayoutContent user={{ email: "buyer@example.com", fullName: "Buyer", avatarUrl: null }} shop={null}><p>Purchases</p></DashboardLayoutContent>);
  for (const link of screen.getAllByRole("link")) expect(link).toHaveAttribute("href", "/");
  for (const nav of screen.getAllByRole("navigation")) expect(nav).toHaveAttribute("data-has-shop", "false");
  expect(screen.getByText("Buyer")).toBeInTheDocument();
});
