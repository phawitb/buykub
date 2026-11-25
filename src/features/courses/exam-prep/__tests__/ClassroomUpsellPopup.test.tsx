import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { busyHash, ClassroomUpsellPopup, UPSELL_AGAIN_MS, UPSELL_FIRST_MS } from "../ClassroomUpsellPopup";
import type { ClassroomUpsell } from "../upsell";

const full = { id: "full", name: "ข้อสอบเสมือนจริง (ตัวเต็ม)", href: "/mysheet/full", priceCents: 5900, compareCents: 12900, cover: null };
const upsell: ClassroomUpsell = {
  shopName: "ร้านชีสส์", upgrade: full,
  items: [full, { id: "c7", name: "คอร์ส 7 วัน", href: "/mysheet/c7", priceCents: 8900, compareCents: null, cover: "https://example.com/c.png" }],
};
const wait = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });
const go = (hash: string) => act(async () => { window.location.hash = hash; window.dispatchEvent(new HashChangeEvent("hashchange")); });

describe("ClassroomUpsellPopup", () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); window.location.hash = ""; });
  afterEach(() => vi.useRealTimers());

  it("opens a few seconds in with the full version first, and closes from X", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ClassroomUpsellPopup upsell={upsell} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await wait(UPSELL_FIRST_MS);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/mysheet/full");
    expect(links[0]).toHaveTextContent("ตัวเต็ม");
    expect(links[0]).toHaveTextContent("฿59");
    expect(links[0]).toHaveTextContent("฿129");
    await user.click(screen.getByRole("button", { name: "ปิดโฆษณา" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("comes back no sooner than ten minutes, and never mid-question", async () => {
    render(<ClassroomUpsellPopup upsell={upsell} />);
    await wait(UPSELL_FIRST_MS);
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    await go("#practice");
    expect(screen.queryByRole("dialog")).toBeNull();
    await wait(UPSELL_AGAIN_MS);
    await go("#quiz-math-0");
    expect(screen.queryByRole("dialog")).toBeNull();
    await go("#home");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("knows which views are under way", () => {
    expect(busyHash("#quiz-math")).toBe(true);
    expect(busyHash("#mock-2")).toBe(true);
    expect(busyHash("#mock")).toBe(false);
    expect(busyHash("#practice-math")).toBe(false);
  });
});
