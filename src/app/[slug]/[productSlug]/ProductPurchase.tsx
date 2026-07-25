"use client";

import { MockCheckout } from "@/features/storefront/MockCheckout";

export function ProductPurchase({
  product,
}: {
  product: {
    id: string;
    shopId: string;
    name: string;
    priceCents: number;
  };
}) {
  return <MockCheckout product={product} />;
}
