import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UpgradePlans } from "@/app/dashboard/settings/upgrade/UpgradePlans";

describe("UpgradePlans", () => {
  it("switches annual prices and keeps subscription checkout clearly mocked", async () => {
    const user = userEvent.setup();
    render(<UpgradePlans />);

    expect(screen.getByText("฿399")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /รายปี/ }));
    expect(screen.getByText("฿3,990")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "เริ่มใช้ Pro" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "ตัวอย่างเท่านั้น — ยังไม่มีการเรียกเก็บเงินจริง",
    );
  });

  it("renders the comparison table without duplicate React keys", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<UpgradePlans />);

    expect(consoleError).not.toHaveBeenCalled();
  });
});
