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

  it("shows Calendar sync and Google Meet details", () => {
    render(
      <BookingRow
        booking={{
          id: "booking-2",
          buyer_name: "Calendar buyer",
          buyer_email: "calendar@example.com",
          scheduled_at: "2026-07-28T09:00:00.000Z",
          price_cents: 50000,
          status: "confirmed",
          services: { name: "ปรึกษา 1:1" },
          calendar_sync_status: "synced",
          google_meet_url: "https://meet.google.com/abc-defg-hij",
        }}
      />,
    );

    expect(screen.getByText("อยู่ใน Google Calendar แล้ว")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิด Google Meet ↗" })).toHaveAttribute(
      "href",
      "https://meet.google.com/abc-defg-hij",
    );
  });
});
