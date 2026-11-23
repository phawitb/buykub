import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReferralButton } from "../ReferralButton";

describe("ReferralButton", () => {
  it("explains what to do with the link and what one referred sale earns", () => {
    render(<ReferralButton productId="p" rateBp={1000} priceCents={18900} name="Guide" />);
    expect(screen.getByRole("button", { name: "ชวนเพื่อน รับ 10%" })).toBeInTheDocument();
    expect(screen.getByText("฿18.90")).toBeInTheDocument();
    expect(screen.getByText(/ซื้อภายใน 30 วัน/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ดูยอดและตั้งบัญชีรับเงิน/ })).toHaveAttribute("href", "/learn/affiliate");
  });
});
