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
});
