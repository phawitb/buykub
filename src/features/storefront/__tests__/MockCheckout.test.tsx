import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MockCheckout } from "@/features/storefront/MockCheckout";

const product = {
  id: "product-123",
  shopId: "shop-123",
  name: "E-Book + Audio Book",
  priceCents: 38900,
};

describe("MockCheckout", () => {
  it("blocks invalid buyer data and discloses that no charge occurs", async () => {
    const user = userEvent.setup();
    render(<MockCheckout product={product} createOrder={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "ซื้อเลย ฿389" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("ทดลองเท่านั้น — ไม่มีการตัดเงินจริง"),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("ชื่อผู้ซื้อ"), "Ada");
    await user.type(screen.getByLabelText("อีเมล"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "ยืนยันคำสั่งซื้อทดลอง" }));

    expect(screen.getByText("กรุณากรอกอีเมลให้ถูกต้อง")).toBeInTheDocument();
  });

  it("creates one mock order and renders the success state", async () => {
    const user = userEvent.setup();
    const createOrder = vi.fn().mockResolvedValue(undefined);
    render(<MockCheckout product={product} createOrder={createOrder} />);

    await user.click(screen.getByRole("button", { name: "ซื้อเลย ฿389" }));
    const nameInput = screen.getByLabelText("ชื่อผู้ซื้อ");
    const emailInput = screen.getByLabelText("อีเมล");
    await user.type(nameInput, "Ada");
    expect(nameInput).toHaveValue("Ada");
    await user.type(emailInput, "ADA@EXAMPLE.COM");
    expect(emailInput).toHaveValue("ADA@EXAMPLE.COM");
    await user.click(screen.getByLabelText("บัตรเครดิต"));
    await user.click(screen.getByRole("button", { name: "ยืนยันคำสั่งซื้อทดลอง" }));

    expect(await screen.findByText("สร้างคำสั่งซื้อทดลองแล้ว")).toBeInTheDocument();
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(createOrder).toHaveBeenCalledWith({
      buyerName: "Ada",
      buyerEmail: "ada@example.com",
      paymentMethod: "card",
    });
  });

  it("keeps keyboard focus inside the dialog and restores it on Escape", async () => {
    const user = userEvent.setup();
    render(<MockCheckout product={product} createOrder={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "ซื้อเลย ฿389" });

    await user.click(trigger);
    const closeButton = screen.getByRole("button", { name: "ปิดหน้าชำระเงิน" });
    closeButton.focus();
    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(
      screen.getByRole("button", { name: "ยืนยันคำสั่งซื้อทดลอง" }),
    ).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
