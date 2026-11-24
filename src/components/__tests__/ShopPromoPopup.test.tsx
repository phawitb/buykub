import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROMO_DELAY_MS, PROMO_SNOOZE_MS, ShopPromoPopup, type ShopPromoData } from "@/components/ShopPromoPopup";

const promo: ShopPromoData = {
  slug: "mysheet",
  name: "ร้านชีสส์",
  headline: "คอร์สติวสอบตำรวจ สายอำนวยการ และ นสต.",
  bio: "สรุปโน๊ตเตรียมสอบ + ระบบฝึกฝนออนไลน์",
  avatarUrl: null,
  covers: ["https://example.com/a.png", "https://example.com/b.png"],
  productCount: 3,
  fromCents: 8900,
  fromCompareCents: 18900,
  maxDiscount: 62,
};

async function appear() {
  await act(async () => {
    vi.advanceTimersByTime(PROMO_DELAY_MS + 50);
  });
}

describe("ShopPromoPopup", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("rises a moment after the page opens and links to the shop", async () => {
    render(<ShopPromoPopup promo={promo} />);
    expect(screen.queryByRole("complementary")).toBeNull();
    await appear();

    const ad = screen.getByRole("complementary", { name: "โฆษณาร้าน ร้านชีสส์" });
    expect(ad).toHaveTextContent("เริ่มต้น฿89");
    expect(ad).toHaveTextContent("ลดสูงสุด 62%");
    expect(screen.getByRole("link", { name: "ดูคอร์ส" })).toHaveAttribute("href", "/mysheet");
  });

  it("closes from the corner button and stays closed for a day", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = render(<ShopPromoPopup promo={promo} />);
    await appear();
    await user.click(screen.getByRole("button", { name: "ปิดโฆษณา" }));
    expect(screen.queryByRole("complementary")).toBeNull();
    unmount();

    render(<ShopPromoPopup promo={promo} />);
    await appear();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("comes back once the day has passed", async () => {
    window.localStorage.setItem("bk_promo_closed:mysheet", String(Date.now() - PROMO_SNOOZE_MS - 1));
    render(<ShopPromoPopup promo={promo} />);
    await appear();
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ShopPromoPopup promo={promo} />);
    await appear();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});
