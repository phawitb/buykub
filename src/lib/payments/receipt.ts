/** Legacy Stripe Session IDs and native PromptPay receipt capabilities. */
export function isReceiptId(value: unknown): value is string {
  return typeof value === "string" && /^(?:cs_(?:test_|live_)?[a-zA-Z0-9]{20,240}|pp_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(value);
}
