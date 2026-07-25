import { createPublicClient } from "@/lib/supabase/public";

export const EVENT_DEDUPE_MS = 30 * 60 * 1000;

export type StorefrontEventType =
  | "view_product"
  | "click_buy"
  | "open_checkout"
  | "purchase";

function eventStorageKey(event: StorefrontEventType, productId: string) {
  return `framelink:event:${event}:${productId}`;
}

export function shouldRecordStorefrontEvent(
  storage: Pick<Storage, "getItem" | "setItem">,
  event: StorefrontEventType,
  productId: string,
  now = Date.now(),
) {
  const key = eventStorageKey(event, productId);
  const lastRecordedAt = Number(storage.getItem(key));
  if (
    Number.isFinite(lastRecordedAt) &&
    lastRecordedAt > 0 &&
    now - lastRecordedAt < EVENT_DEDUPE_MS
  ) {
    return false;
  }
  storage.setItem(key, String(now));
  return true;
}

function visitorId(storage: Pick<Storage, "getItem" | "setItem">) {
  const key = "framelink:visitor";
  const existing = storage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  storage.setItem(key, created);
  return created;
}

export async function trackStorefrontEvent({
  event,
  productId,
  shopId,
}: {
  event: StorefrontEventType;
  productId: string;
  shopId: string;
}) {
  if (typeof window === "undefined") return;
  if (!shouldRecordStorefrontEvent(window.localStorage, event, productId)) return;

  await createPublicClient().from("analytics_events").insert({
    event_type: event,
    product_id: productId,
    shop_id: shopId,
    visitor_id: visitorId(window.localStorage),
  });
}
