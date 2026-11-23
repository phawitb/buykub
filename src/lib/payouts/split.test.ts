import { describe, expect, it } from "vitest";
import { saleSplit } from "./split";
import { payoutAmount } from "./eligibility";

describe("saleSplit", () => {
  it("splits a sale between the shop, the fee and the referrer", () => {
    expect(saleSplit(1900, 1000)).toEqual({ feeCents: 95, referralCents: 190, shopCents: 1615 });
    expect(saleSplit(1900)).toEqual({ feeCents: 95, referralCents: 0, shopCents: 1805 });
  });
  it("rounds the fee half up and the commission down, like the payout ledger", () => {
    expect(saleSplit(1990, 250)).toEqual({ feeCents: 100, referralCents: 49, shopCents: 1841 });
    expect(payoutAmount(1990, 0, 250)).toBe(1841);
  });
  it("is empty for a free product", () => {
    expect(saleSplit(0, 1000)).toEqual({ feeCents: 0, referralCents: 0, shopCents: 0 });
  });
});
