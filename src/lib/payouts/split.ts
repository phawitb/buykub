/** BUYKUB's fee on each order, in basis points. */
export const PLATFORM_FEE_BP = 500;

export type SaleSplit = { feeCents: number; referralCents: number; shopCents: number };

/**
 * How one paid order is divided, matching prepare_seller_payout_batch: the 5% fee
 * rounds half up to a satang, the referral commission rounds down, the shop keeps the rest.
 */
export function saleSplit(cents: number, referralRateBp = 0): SaleSplit {
  if (!Number.isSafeInteger(cents) || cents <= 0) return { feeCents: 0, referralCents: 0, shopCents: 0 };
  const feeCents = Math.floor((cents * PLATFORM_FEE_BP / 100 + 50) / 100);
  const referralCents = Number.isSafeInteger(referralRateBp) && referralRateBp > 0 ? Math.floor(cents * referralRateBp / 10000) : 0;
  return { feeCents, referralCents, shopCents: Math.max(0, cents - feeCents - referralCents) };
}
