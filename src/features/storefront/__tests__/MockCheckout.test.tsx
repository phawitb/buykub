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
  it("shows a sticky purchase bar after the primary CTA leaves the viewport", async () => {
    let notify:
      | ((entries: Array<{ isIntersecting: boolean }>) => void)
      | undefined;
    class ObserverMock {
      constructor(callback: typeof notify) {
        notify = callback;
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", ObserverMock);
    render(<MockCheckout product={product} createOrder={vi.fn()} />);

    notify?.([{ isIntersecting: false }]);

    expect(
      await screen.findByRole("button", { name: /^ซื้อเลย$/ }),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("blocks invalid buyer data and discloses that no charge occurs", async () => {
    const user = userEvent.setup();
    render(<MockCheckout product={product} createOrder={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "ซื้อเลย ฿389" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("ทดลองเท่านั้น — ไม่มีการตัดเงินจริง"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "ชำระเงิน" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("ชื่อผู้ซื้อ")).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "card",
      "promptpay",
    ]);

    await user.type(screen.getByLabelText("อีเมล"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "ชำระเงิน (ทดลอง)" }));

    expect(screen.getByText("กรุณากรอกอีเมลให้ถูกต้อง")).toBeInTheDocument();
  });

  it("creates one mock order and renders the success state", async () => {
    const user = userEvent.setup();
    const createOrder = vi.fn().mockResolvedValue(undefined);
    render(<MockCheckout product={product} createOrder={createOrder} />);

    await user.click(screen.getByRole("button", { name: "ซื้อเลย ฿389" }));
    const emailInput = screen.getByLabelText("อีเมล");
    await user.type(emailInput, "ADA@EXAMPLE.COM");
    expect(emailInput).toHaveValue("ADA@EXAMPLE.COM");
    await user.click(screen.getByRole("button", { name: "ชำระเงิน (ทดลอง)" }));

    expect(await screen.findByText("สร้างคำสั่งซื้อทดลองแล้ว")).toBeInTheDocument();
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(createOrder).toHaveBeenCalledWith({
      buyerName: "",
      buyerEmail: "ada@example.com",
      paymentMethod: "card",
    });
  });

  it("reveals an assigned product key and copies it", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <MockCheckout
        product={{
          ...product,
          deliveryType: "key",
          availableStock: 1,
        }}
        createOrder={vi.fn().mockResolvedValue({
          orderId: "order-1",
          deliveryType: "key",
          assignedKey: "AAAA-BBBB-CCCC",
          emailStatus: "sent",
          remainingStock: 0,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "ซื้อเลย ฿389" }));
    await user.type(screen.getByLabelText("อีเมล"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "ชำระเงิน (ทดลอง)" }));

    expect(await screen.findByText("AAAA-BBBB-CCCC")).toBeInTheDocument();
    expect(screen.getByText("ส่ง Key ไปยังอีเมลแล้ว")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "คัดลอก Key" }));
    expect(writeText).toHaveBeenCalledWith("AAAA-BBBB-CCCC");
  });

  it("disables every purchase button when key stock is empty", async () => {
    render(
      <MockCheckout
        product={{
          ...product,
          deliveryType: "key",
          availableStock: 0,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "สินค้าหมด" })).toBeDisabled();
  });

  it("records the buy, checkout, and purchase funnel steps", async () => {
    const user = userEvent.setup();
    const trackEvent = vi.fn().mockResolvedValue(undefined);
    render(
      <MockCheckout
        product={product}
        createOrder={vi.fn().mockResolvedValue(undefined)}
        trackEvent={trackEvent}
      />,
    );

    await user.click(screen.getByRole("button", { name: "ซื้อเลย ฿389" }));
    await user.type(screen.getByLabelText("อีเมล"), "ada@example.com");
    await user.click(
      screen.getByRole("button", { name: "ชำระเงิน (ทดลอง)" }),
    );

    expect(trackEvent.mock.calls.map(([event]) => event)).toEqual([
      "click_buy",
      "open_checkout",
      "purchase",
    ]);
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
      screen.getByRole("button", { name: "ชำระเงิน (ทดลอง)" }),
    ).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
