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
    await user.click(screen.getByRole("button", { name: "เลือกธนาคาร" }));
    await user.click(screen.getByRole("button", { name: /ธนาคารกสิกรไทย/ }));
    await user.type(screen.getByRole("textbox", { name: "เลขบัญชี" }), "1234567890");
    await user.type(screen.getByRole("textbox", { name: "ชื่อบัญชี" }), "Owner");

    await waitFor(() =>
      expect(readSettingsDraft("user-1")?.name).toBe("Draft shop"),
    );
    firstRender.unmount();
    render(<SettingsForm userId="user-1" initial={initial} />);

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "ชื่อร้าน" })).toHaveValue(
        "Draft shop",
      ),
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
    expect(screen.getByText("ธนาคารกสิกรไทย")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "เลขบัญชี" })).toHaveValue(
      "1234567890",
    );
    expect(screen.getByRole("textbox", { name: "ชื่อบัญชี" })).toHaveValue(
      "Owner",
    );
  });

  it("serializes the selected bank and validates structured account fields", async () => {
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
          payout_method: "bank",
          promptpay_id: "",
          bank_details: "",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(screen.getByText("กรุณาเลือกธนาคาร")).toBeInTheDocument();
    expect(screen.getByText("กรอกเลขบัญชี 6–16 หลัก")).toBeInTheDocument();
    expect(screen.getByText("กรุณากรอกชื่อบัญชี")).toBeInTheDocument();
    expect(saveSettings).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "เลือกธนาคาร" }));
    await user.click(screen.getByRole("button", { name: /ธนาคารไทยพาณิชย์/ }));
    await user.type(screen.getByRole("textbox", { name: "เลขบัญชี" }), "1234567890");
    await user.type(screen.getByRole("textbox", { name: "ชื่อบัญชี" }), "สมชาย");
    await user.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(saveSettings).toHaveBeenCalledOnce());
    const payload = saveSettings.mock.calls[0][0];
    expect(JSON.parse(payload.bank_details)).toEqual({
      version: 1,
      bankCode: "scb",
      accountNumber: "1234567890",
      accountName: "สมชาย",
    });
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
