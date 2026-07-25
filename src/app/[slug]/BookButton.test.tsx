import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BookButton } from "./BookButton";

function tomorrowAtNoon() {
  const date = new Date(Date.now() + 86_400_000);
  date.setHours(12, 0, 0, 0);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

const props = {
  serviceId: "service-1",
  shopId: "shop-1",
  serviceName: "ปรึกษา 1:1",
  priceCents: 89000,
  durationMinutes: 60,
  availability: {
    days: [0, 1, 2, 3, 4, 5, 6],
    start: "00:00",
    end: "23:59",
    advance_days: 30,
  },
};

describe("BookButton", () => {
  it("collects customer details and creates a booking", async () => {
    const user = userEvent.setup();
    const createBooking = vi.fn().mockResolvedValue(undefined);
    render(<BookButton {...props} createBooking={createBooking} />);

    await user.click(screen.getByRole("button", { name: "จองบริการ" }));
    expect(screen.getByRole("dialog", { name: "จองบริการ" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("ชื่อผู้จอง"), "ลูกค้าทดสอบ");
    await user.type(screen.getByLabelText("อีเมล"), "buyer@example.com");
    fireEvent.change(screen.getByLabelText("วันและเวลา"), {
      target: { value: tomorrowAtNoon() },
    });
    await user.click(screen.getByRole("button", { name: /ยืนยันการจอง ฿890/ }));

    await vi.waitFor(() => expect(createBooking).toHaveBeenCalledOnce());
    expect(screen.getByText("ยืนยันการจองแล้ว")).toBeInTheDocument();
  });

  it("shows field validation instead of creating an empty booking", async () => {
    const user = userEvent.setup();
    const createBooking = vi.fn();
    render(<BookButton {...props} createBooking={createBooking} />);

    await user.click(screen.getByRole("button", { name: "จองบริการ" }));
    await user.click(screen.getByRole("button", { name: /ยืนยันการจอง ฿890/ }));

    expect(screen.getByText("กรุณากรอกชื่อผู้จอง")).toBeInTheDocument();
    expect(screen.getByText("กรุณากรอกอีเมลให้ถูกต้อง")).toBeInTheDocument();
    expect(screen.getByText("กรุณาเลือกวันและเวลาในอนาคต")).toBeInTheDocument();
    expect(createBooking).not.toHaveBeenCalled();
  });

  it("shows the Google Meet link when calendar sync succeeds", async () => {
    const user = userEvent.setup();
    const createBooking = vi.fn().mockResolvedValue({
      calendarSynced: true,
      meetUrl: "https://meet.google.com/abc-defg-hij",
    });
    render(<BookButton {...props} createBooking={createBooking} />);

    await user.click(screen.getByRole("button", { name: "จองบริการ" }));
    await user.type(screen.getByLabelText("ชื่อผู้จอง"), "ลูกค้าทดสอบ");
    await user.type(screen.getByLabelText("อีเมล"), "buyer@example.com");
    fireEvent.change(screen.getByLabelText("วันและเวลา"), {
      target: { value: tomorrowAtNoon() },
    });
    await user.click(screen.getByRole("button", { name: /ยืนยันการจอง ฿890/ }));

    expect(
      await screen.findByText("เพิ่มนัดลง Google Calendar แล้ว"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิด Google Meet" })).toHaveAttribute(
      "href",
      "https://meet.google.com/abc-defg-hij",
    );
  });
});
