import { describe, expect, it } from "vitest";
import {
  EVENT_DEDUPE_MS,
  shouldRecordStorefrontEvent,
} from "@/features/analytics/tracking";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("shouldRecordStorefrontEvent", () => {
  it("deduplicates the same visitor event for 30 minutes", () => {
    const storage = new MemoryStorage();
    const at = Date.parse("2026-07-25T10:00:00.000Z");

    expect(
      shouldRecordStorefrontEvent(storage, "view_product", "product-1", at),
    ).toBe(true);
    expect(
      shouldRecordStorefrontEvent(
        storage,
        "view_product",
        "product-1",
        at + EVENT_DEDUPE_MS - 1,
      ),
    ).toBe(false);
    expect(
      shouldRecordStorefrontEvent(
        storage,
        "view_product",
        "product-1",
        at + EVENT_DEDUPE_MS,
      ),
    ).toBe(true);
  });

  it("tracks different event types independently", () => {
    const storage = new MemoryStorage();
    const at = Date.parse("2026-07-25T10:00:00.000Z");

    expect(
      shouldRecordStorefrontEvent(storage, "view_product", "product-1", at),
    ).toBe(true);
    expect(
      shouldRecordStorefrontEvent(storage, "click_buy", "product-1", at),
    ).toBe(true);
  });
});
