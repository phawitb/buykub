import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OrderActions } from "./OrderActions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("OrderActions", () => {
  it("marks a paid mock order as refunded after confirmation", async () => {
    const user = userEvent.setup();
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <OrderActions
        orderId="order-1"
        status="paid"
        updateStatus={updateStatus}
      />,
    );

    await user.click(screen.getByRole("button", { name: "คืนเงิน (Mock)" }));
    expect(updateStatus).toHaveBeenCalledWith("refunded");
  });

  it("copies an assigned key and retries failed email delivery", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    render(
      <OrderActions
        orderId="order-1"
        status="paid"
        assignedKey="AAAA-BBBB"
        emailStatus="failed"
        emailToken="token-1"
        sendEmail={sendEmail}
      />,
    );

    await user.click(screen.getByRole("button", { name: "คัดลอก Key" }));
    expect(writeText).toHaveBeenCalledWith("AAAA-BBBB");
    await user.click(screen.getByRole("button", { name: "ส่งอีเมลอีกครั้ง" }));
    expect(sendEmail).toHaveBeenCalledWith("order-1", "token-1");
  });
});
