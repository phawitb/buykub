import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsForm } from "@/app/dashboard/settings/SettingsForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("SettingsForm", () => {
  it("offers named PIXZA-style accent presets", async () => {
    const user = userEvent.setup();
    render(
      <SettingsForm
        userId="user-1"
        initial={{
          id: "shop-1",
          slug: "my-shop",
          name: "My shop",
          bio: "",
          avatar_url: null,
          cover_url: null,
          accent_color: "#f97316",
          payout_method: "promptpay",
          promptpay_id: "",
          bank_details: "",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Violet" }));

    expect(screen.getByLabelText("ค่าสี accent")).toHaveValue("#7c3aed");
  });
});
