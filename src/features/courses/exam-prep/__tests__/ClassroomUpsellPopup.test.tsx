import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { busyHash, ClassroomUpsellPopup, UPSELL_AGAIN_MS, UPSELL_FIRST_MS, UPSELL_POLL_MS } from "../ClassroomUpsellPopup";
import type { ClassroomUpsell } from "../upsell";

const full = { id: "full", name: "ข้อสอบเสมือนจริง (ตัวเต็ม)", href: "/mysheet/full", priceCents: 5900, compareCents: 12900, cover: null };
const upsell: ClassroomUpsell = {
  shopName: "ร้านชีสส์", upgrade: full,
  items: [full, { id: "c7", name: "คอร์ส 7 วัน", href: "/mysheet/c7", priceCents: 8900, compareCents: null, cover: "https://example.com/c.png" }],
};
const wait = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });

describe("ClassroomUpsellPopup", () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); window.location.hash = ""; });
  afterEach(() => vi.useRealTimers());

  it("opens a few seconds in with the full version first, and closes from X", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ClassroomUpsellPopup upsell={upsell} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await wait(UPSELL_FIRST_MS + UPSELL_POLL_MS);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/mysheet/full");
    expect(links[0]).toHaveTextContent("ตัวเต็ม");
    expect(links[0]).toHaveTextContent("฿59");
    expect(links[0]).toHaveTextContent("฿129");
    await user.click(screen.getByRole("button", { name: "ปิดโฆษณา" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("waits out an unanswered question and comes back no sooner than ten minutes", async () => {
    const room = document.createElement("div");
    room.className = "exam-prep";
    room.setAttribute("data-busy", "");
    document.body.append(room);
    render(<ClassroomUpsellPopup upsell={upsell} />);
    await wait(UPSELL_FIRST_MS + UPSELL_POLL_MS);
    expect(screen.queryByRole("dialog")).toBeNull();
    room.removeAttribute("data-busy");
    await wait(UPSELL_POLL_MS);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    await wait(UPSELL_AGAIN_MS - 2 * UPSELL_POLL_MS);
    expect(screen.queryByRole("dialog")).toBeNull();
    window.location.hash = "#mock-1";
    await wait(4 * UPSELL_POLL_MS);
    expect(screen.queryByRole("dialog")).toBeNull();
    window.location.hash = "#mock";
    await wait(UPSELL_POLL_MS);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    room.remove();
  });

  it("knows which views are under way", () => {
    expect(busyHash("#quiz")).toBe(false);
    expect(busyHash("#mock-2")).toBe(true);
    expect(busyHash("#mock")).toBe(false);
    expect(busyHash("#practice-math")).toBe(false);
  });
});
