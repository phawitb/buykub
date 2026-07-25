import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BookingRow } from "./BookingRow";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("BookingRow", () => {
  it("shows customer details and lets the owner cancel a confirmed booking", async () => {
    const user = userEvent.setup();
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <BookingRow
        booking={{
          id: "booking-1",
          buyer_name: "ลูกค้าทดสอบ",
          buyer_email: "buyer@example.com",
          scheduled_at: "2026-07-28T09:00:00.000Z",
          price_cents: 50000,
          status: "confirmed",
          services: { name: "ปรึกษา 1:1" },
        }}
        updateStatus={updateStatus}
      />,
    );

    expect(screen.getByText("ลูกค้าทดสอบ")).toBeInTheDocument();
    expect(screen.getByText("buyer@example.com")).toBeInTheDocument();
    expect(screen.getByText("ยืนยันแล้ว")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ยกเลิกการจอง" }));
    expect(updateStatus).toHaveBeenCalledWith("cancelled");
  });
});
