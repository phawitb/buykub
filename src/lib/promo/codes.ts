/** Codes are stored upper case: 3–30 letters, digits, "-" or "_". */
export const PROMO_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,29}$/;

export function normalizePromoCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return PROMO_CODE_PATTERN.test(code) ? code : null;
}

export type PromoQuote = { code: string; listCents: number; discountCents: number; finalCents: number };

const messages: Record<string, string> = {
  promo_invalid: "ไม่พบโค้ดนี้ หรือโค้ดถูกปิดใช้งานแล้ว",
  promo_expired: "โค้ดนี้หมดอายุแล้ว",
  promo_not_for_product: "โค้ดนี้ใช้กับสินค้านี้ไม่ได้",
  promo_used_up: "โค้ดนี้ถูกใช้ครบจำนวนแล้ว",
  promo_already_used: "บัญชีนี้ใช้โค้ดนี้ไปแล้ว",
  promo_below_minimum: "ใช้โค้ดนี้แล้วราคาต่ำกว่า ฿10 ซึ่งชำระผ่าน PromptPay ไม่ได้ กรุณาแจ้งร้านค้า",
};

/** Thai message for a refusal raised by the database, or null if it is not a promo refusal. */
export function promoErrorMessage(raw: string | undefined | null): string | null {
  const key = Object.keys(messages).find((name) => raw?.includes(name));
  return key ? messages[key] : null;
}

/** "ลด 20%" or "ลด ฿50". */
export function promoDiscountLabel(code: { percent_off: number | null; amount_off_cents: number | null }) {
  return code.percent_off != null ? `ลด ${code.percent_off}%` : `ลด ฿${((code.amount_off_cents ?? 0) / 100).toLocaleString("th-TH")}`;
}
