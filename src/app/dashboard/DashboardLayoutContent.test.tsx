import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardLayoutContent } from "./DashboardLayoutContent";

vi.mock("./DashboardNavigation", () => ({
  DashboardNavigation: ({ mobile }: { mobile?: boolean }) => (
    <nav aria-label={mobile ? "เมนูมือถือ" : "เมนูหลัก"} />
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
    expect(screen.getByText("framelink.app/example")).toBeInTheDocument();
    expect(screen.getByText("เนื้อหา")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /อัปเกรด/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Free")).not.toBeInTheDocument();
    expect(screen.queryByText(/watermark/i)).not.toBeInTheDocument();
  });
});
