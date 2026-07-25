"use client";

import { useEffect } from "react";
import { trackStorefrontEvent } from "@/features/analytics/tracking";

type TrackProductView = (input: {
  event: "view_product";
  productId: string;
  shopId: string;
}) => Promise<void>;

export function ProductViewTracker({
  productId,
  shopId,
  trackEvent = trackStorefrontEvent,
}: {
  productId: string;
  shopId: string;
  trackEvent?: TrackProductView;
}) {
  useEffect(() => {
    void trackEvent({
      event: "view_product",
      productId,
      shopId,
    }).catch(() => undefined);
  }, [productId, shopId, trackEvent]);

  return null;
}
