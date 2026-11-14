import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsForm } from "@/app/dashboard/settings/SettingsForm";

const database = vi.hoisted(() => {
  const query = { upsert: vi.fn(), select: vi.fn(), single: vi.fn() };
  return { query, from: vi.fn() };
});
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: database.from }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const identity = { full_name_th: "สมชาย ใจดี", contact_phone: "0812345678", national_id: "1101700207030", address_line: "12/3 หมู่ 4", subdistrict: "คลองตัน", district: "คลองเตย", province: "กรุงเทพมหานคร", postal_code: "10110" };

describe("SettingsForm", () => {
  beforeEach(() => sessionStorage.clear());

  it("rejects an invalid PromptPay ID before saving settings", async () => {
    const user = userEvent.setup();
    const saveSettings = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsForm
        userId="user-1"
        saveSettings={saveSettings}
        initial={{
          ...identity,
          id: "shop-1",
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

  it("presents payout methods as PIXZA-style choice cards", () => {
    render(
      <SettingsForm
        userId="user-1"
        initial={{
          ...identity,
          id: "shop-1",
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

  it("serializes the selected bank and validates structured account fields", async () => {
    const user = userEvent.setup();
    const saveSettings = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsForm
        userId="user-1"
        saveSettings={saveSettings}
        initial={{
          ...identity,
          id: "shop-1",
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

    expect(screen.getAllByText("ชื่อบัญชีต้องเป็นชื่อเดียวกับข้อมูลที่ให้ไว้ข้างต้นเท่านั้น").length).toBeGreaterThan(0);
    expect(saveSettings).not.toHaveBeenCalled();
    await user.clear(screen.getByRole("textbox", { name: "ชื่อบัญชี" }));
    await user.type(screen.getByRole("textbox", { name: "ชื่อบัญชี" }), "สมชาย  ใจดี");
    await user.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(saveSettings).toHaveBeenCalledOnce());
    const payload = saveSettings.mock.calls[0][0];
    expect(JSON.parse(payload.bank_details)).toEqual({
      version: 1,
      bankCode: "scb",
      accountNumber: "1234567890",
      accountName: "สมชาย ใจดี",
    });
  });

  it("saves payout only and has no appearance fields", async () => {
    const user = userEvent.setup();
    const saveSettings = vi.fn().mockResolvedValue(undefined);
    render(<SettingsForm userId="user-1" saveSettings={saveSettings} initial={{ ...identity, id: "shop-1", payout_method: "promptpay", promptpay_id: "0812345678", bank_details: "" }} />);
    expect(screen.queryByRole("textbox", { name: "ชื่อร้าน" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("ค่าสี accent")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    await waitFor(() => expect(saveSettings).toHaveBeenCalledOnce());
    expect(saveSettings.mock.calls[0][0]).toEqual({ ...identity, payout_method: "promptpay", promptpay_id: "0812345678", bank_details: null });
  });
});

it("removes old private drafts and never persists identity or payout changes in browser storage", async () => {
  const user = userEvent.setup();
  sessionStorage.clear(); localStorage.clear();
  const appearance = JSON.stringify({ name: "Unsaved shop" });
  sessionStorage.setItem("buykub:appearance-draft:user-1:shop-1", appearance);
  sessionStorage.setItem("buykub:payout-draft:user-1:shop-1", JSON.stringify({ promptpayId: "0898765432" }));
  localStorage.setItem("buykub:payout-draft:previous-user:old-shop", "old sensitive data");
  sessionStorage.setItem("framelink:settings-draft:user-1", JSON.stringify({ promptpayId: "0898765432" }));
  localStorage.setItem("framelink:settings-draft:previous-user", "old bank account details");
  render(<SettingsForm userId="user-1" initial={{ ...identity, id: "shop-1", payout_method: "promptpay", promptpay_id: "0812345678", bank_details: "" }} />);
  expect(screen.getByRole("textbox", { name: /เลข PromptPay/ })).toHaveValue("0812345678");
  await user.clear(screen.getByLabelText(/เลขบัตรประชาชน 13 หลัก/));
  await user.type(screen.getByLabelText(/เลขบัตรประชาชน 13 หลัก/), "1101700207031");
  expect(sessionStorage.getItem("buykub:payout-draft:user-1:shop-1")).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(1);
  expect(sessionStorage.getItem("buykub:appearance-draft:user-1:shop-1")).toBe(appearance);
});

it("atomically upserts all payout identity and payment fields to the private table", async () => {
  const user = userEvent.setup();
  vi.clearAllMocks();
  database.from.mockReturnValue(database.query);
  for (const method of [database.query.upsert, database.query.select]) method.mockReturnValue(database.query);
  database.query.single.mockResolvedValue({ data: { shop_id: "shop-1" }, error: null });
  render(<SettingsForm userId="user-1" initial={{ ...identity, id: "shop-1", payout_method: "promptpay", promptpay_id: "0812345678", bank_details: "" }} />);
  await user.click(screen.getByRole("button", { name: "บันทึก" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("บันทึกสำเร็จ"));
  expect(database.from).toHaveBeenCalledWith("seller_payout_profiles");
  expect(database.query.upsert).toHaveBeenCalledWith({ shop_id: "shop-1", ...identity, payout_method: "promptpay", promptpay_id: "0812345678", bank_details: null }, { onConflict: "shop_id" });
});

it("reports a denied save without success or browser storage persistence", async () => {
  const user = userEvent.setup();
  sessionStorage.clear();
  vi.clearAllMocks();
  database.from.mockReturnValue(database.query);
  for (const method of [database.query.upsert, database.query.select]) method.mockReturnValue(database.query);
  database.query.single.mockResolvedValue({ data: null, error: { message: "Failing row contains national_id=1101700207030 address_line=12/3 หมู่ 4" } });
  render(<SettingsForm userId="user-1" initial={{ ...identity, id: "shop-1", payout_method: "promptpay", promptpay_id: "0812345678", bank_details: "" }} />);
  await user.click(screen.getByRole("button", { name: "บันทึก" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองอีกครั้ง"));
  expect(screen.getByRole("alert")).not.toHaveTextContent("1101700207030");
  expect(screen.getByRole("alert")).not.toHaveTextContent("12/3 หมู่ 4");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(sessionStorage.length).toBe(0);
});

it("requires identity and address before saving and masks national ID until explicitly shown", async () => {
  const user = userEvent.setup();
  const saveSettings = vi.fn();
  render(<SettingsForm userId="user-1" saveSettings={saveSettings} initial={{ id: "shop-1", payout_method: "promptpay", promptpay_id: "0812345678", bank_details: "" }} />);
  const nationalId = screen.getByLabelText(/เลขบัตรประชาชน 13 หลัก/);
  expect(nationalId).toHaveAttribute("type", "password");
  await user.click(screen.getByRole("button", { name: "แสดงเลขบัตรประชาชน" }));
  expect(nationalId).toHaveAttribute("type", "text");
  await user.click(screen.getByRole("button", { name: "บันทึก" }));
  expect(screen.getAllByRole("alert")).toHaveLength(8);
  expect(saveSettings).not.toHaveBeenCalled();
});
