import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OrderActions } from "./OrderActions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("OrderActions", () => {
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
          assignedKey="AAAA-BBBB"
        emailStatus="failed"
        canRetryEmail
        sendEmail={sendEmail}
      />,
    );

    await user.click(screen.getByRole("button", { name: "คัดลอก Key" }));
    expect(writeText).toHaveBeenCalledWith("AAAA-BBBB");
    await user.click(screen.getByRole("button", { name: "ส่งอีเมลอีกครั้ง" }));
    expect(sendEmail).toHaveBeenCalledWith("order-1");
  });
});

it('offers retry and status for a file purchase without requiring a key',async()=>{
  const user=userEvent.setup(); const sendEmail=vi.fn().mockResolvedValue(undefined);
  render(<OrderActions orderId="file-order" emailStatus="failed" canRetryEmail sendEmail={sendEmail} />);
  await user.click(screen.getByRole('button',{name:'ส่งอีเมลอีกครั้ง'}));
  expect(sendEmail).toHaveBeenCalledWith('file-order');
  expect(await screen.findByRole('status')).toHaveTextContent('ส่งอีเมลเรียบร้อยแล้ว');
});
it('does not expose retry for a refunded purchase',()=>{
  render(<OrderActions orderId="refunded-order" assignedKey="KEY" emailStatus="failed" canRetryEmail={false} />);
  expect(screen.queryByRole('button',{name:'ส่งอีเมลอีกครั้ง'})).not.toBeInTheDocument();
});
