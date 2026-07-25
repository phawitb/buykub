import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalendarConnection } from "./CalendarConnection";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("CalendarConnection", () => {
  it("starts a real connection action when Calendar is disconnected", async () => {
    const user = userEvent.setup();
    const connect = vi.fn().mockResolvedValue(undefined);
    render(
      <CalendarConnection
        connected={false}
        connectedEmail={null}
        connect={connect}
      />,
    );

    expect(screen.getByText("ก่อนเชื่อมต่อ Google Calendar")).toBeInTheDocument();
    expect(screen.getByText(/Advanced/)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "เชื่อมต่อ Google Calendar" }),
    );
    expect(connect).toHaveBeenCalledOnce();
  });

  it("shows the connected account and can disconnect it", async () => {
    const user = userEvent.setup();
    const disconnect = vi.fn().mockResolvedValue(undefined);
    render(
      <CalendarConnection
        connected
        connectedEmail="owner@example.com"
        disconnect={disconnect}
      />,
    );

    expect(screen.getByText("เชื่อมต่อแล้ว · owner@example.com")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ตัดการเชื่อมต่อ" }));
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
