import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsForm } from "@/app/dashboard/settings/SettingsForm";
import { readSettingsDraft } from "@/app/dashboard/settings/settings-draft";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("SettingsForm", () => {
  beforeEach(() => sessionStorage.clear());

  it("associates store fields with the same visible labels customers see", () => {
    render(
      <SettingsForm
        userId="user-1"
        initial={{
          id: "shop-1",
          slug: "my-shop",
          name: "My shop",
          bio: "About my shop",
          avatar_url: null,
          cover_url: null,
          accent_color: "#f97316",
          payout_method: "promptpay",
          promptpay_id: "",
          bank_details: "",
        }}
      />,
    );

    expect(screen.getByRole("textbox", { name: "ชื่อร้าน" })).toHaveValue(
      "My shop",
    );
    expect(screen.getByRole("textbox", { name: "URL ร้าน" })).toHaveValue(
      "my-shop",
    );
    expect(screen.getByRole("textbox", { name: /แนะนำร้าน/ })).toHaveAttribute(
      "maxlength",
      "160",
    );
  });

  it("rejects an invalid PromptPay ID before saving settings", async () => {
    const user = userEvent.setup();
    const saveSettings = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsForm
        userId="user-1"
        saveSettings={saveSettings}
        initial={{
          id: "shop-1",
          slug: "my-shop",
          name: "My shop",
          bio: "",
          avatar_url: null,
          cover_url: null,
          accent_color: "#f97316",
          payout_method: "promptpay",
          promptpay_id: "08023423522",
          bank_details: "",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "บันทึก" }));

    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent("กรอกเบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก");
    expect(saveSettings).not.toHaveBeenCalled();
  });

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

  it("presents payout methods as PIXZA-style choice cards", () => {
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

    expect(screen.getByText("เบอร์/บัตรประชาชน")).toBeInTheDocument();
    expect(screen.getByText("ทุกธนาคารไทย")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /PromptPay/ })).toBeChecked();
  });

  it("restores unsaved values after an OAuth-style unmount and remount", async () => {
    const user = userEvent.setup();
    const initial = {
      id: "shop-1",
      slug: "my-shop",
      name: "My shop",
      bio: "",
      avatar_url: null,
      cover_url: null,
      accent_color: "#f97316",
      payout_method: "promptpay" as const,
      promptpay_id: "0812345678",
      bank_details: "",
    };
    const firstRender = render(
      <SettingsForm userId="user-1" initial={initial} />,
    );

    await user.clear(screen.getByRole("textbox", { name: "ชื่อร้าน" }));
    await user.type(
      screen.getByRole("textbox", { name: "ชื่อร้าน" }),
      "Draft shop",
    );
    await user.type(
      screen.getByRole("textbox", { name: /แนะนำร้าน/ }),
      "Unsaved description",
    );
    await user.click(screen.getByRole("button", { name: "Violet" }));
    await user.click(screen.getByRole("radio", { name: /โอนเข้าบัญชีธนาคาร/ }));
    await user.type(
      screen.getByPlaceholderText("ธนาคาร · เลขบัญชี · ชื่อบัญชี"),
      "Example Bank 1234567890 Owner",
    );

    await waitFor(() =>
      expect(readSettingsDraft("user-1")?.name).toBe("Draft shop"),
    );
    firstRender.unmount();
    render(<SettingsForm userId="user-1" initial={initial} />);

    expect(screen.getByRole("textbox", { name: "ชื่อร้าน" })).toHaveValue(
      "Draft shop",
    );
    expect(screen.getByRole("textbox", { name: /แนะนำร้าน/ })).toHaveValue(
      "Unsaved description",
    );
    expect(screen.getByRole("button", { name: "Violet" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("radio", { name: /โอนเข้าบัญชีธนาคาร/ }),
    ).toBeChecked();
    expect(
      screen.getByPlaceholderText("ธนาคาร · เลขบัญชี · ชื่อบัญชี"),
    ).toHaveValue("Example Bank 1234567890 Owner");
  });

  it("clears the draft after settings save succeeds", async () => {
    const user = userEvent.setup();
    const saveSettings = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsForm
        userId="user-1"
        saveSettings={saveSettings}
        initial={{
          id: "shop-1",
          slug: "my-shop",
          name: "My shop",
          bio: "",
          avatar_url: null,
          cover_url: null,
          accent_color: "#f97316",
          payout_method: "promptpay",
          promptpay_id: "0812345678",
          bank_details: "",
        }}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /แนะนำร้าน/ }),
      "Draft",
    );
    await waitFor(() =>
      expect(readSettingsDraft("user-1")?.bio).toBe("Draft"),
    );
    await user.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(saveSettings).toHaveBeenCalledOnce());
    expect(readSettingsDraft("user-1")).toBeNull();
  });
});
