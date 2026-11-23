/** Remembers the last referral link a visitor opened, for 30 days. */
export const REFERRAL_COOKIE = "bk_ref";
export const REFERRAL_MAX_AGE = 30 * 24 * 60 * 60;
const code = /^[a-z0-9]{10}$/;

export function isReferralCode(value: unknown): value is string {
  return typeof value === "string" && code.test(value);
}

/** The referral code in a request's cookies, if it is well formed. */
export function referralFromCookies(header: string | null): string | null {
  for (const part of (header ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === REFERRAL_COOKIE) {
      const candidate = decodeURIComponent(value.join("="));
      return isReferralCode(candidate) ? candidate : null;
    }
  }
  return null;
}

/** Commission rate from basis points, for display: 1000 → "10%", 1250 → "12.5%". */
export function ratePercent(bp: number): string {
  return `${Number((bp / 100).toFixed(2))}%`;
}
