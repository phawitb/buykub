"use client";
import { useEffect, useRef } from "react";
import { createPublicClient } from "@/lib/supabase/public";

export function ShopViewTracker({ shopId }: { shopId: string }) {
  const recorded = useRef<string | null>(null);
  useEffect(() => {
    if (recorded.current === shopId) return;
    recorded.current = shopId;
    // Analytics is best-effort and must never delay displaying the storefront.
    void Promise.resolve(createPublicClient().from("shop_views").insert({ shop_id: shopId })).catch(() => undefined);
  }, [shopId]);
  return null;
}
