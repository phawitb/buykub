import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReferralButton } from "../ReferralButton";

afterEach(() => vi.unstubAllGlobals());

describe("ReferralButton", () => {
  it("explains the link and what one referred sale earns once the button is pressed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ url: "https://buykub.com/r/abc" }), { status: 200 })));
    const user = userEvent.setup();
    render(<ReferralButton productId="p" rateBp={1000} priceCents={18900} name="Guide" />);
    expect(screen.queryByText(/ซื้อภายใน 30 วัน/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ชวนเพื่อน รับ 10%" }));

    expect(await screen.findByText("฿18.90")).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/buykub.com\/r\/abc/)).toBeInTheDocument();
    expect(screen.getByText(/ซื้อภายใน 30 วัน/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ดูยอดและตั้งบัญชีรับเงิน/ })).toHaveAttribute("href", "/learn/affiliate");
  });
});
