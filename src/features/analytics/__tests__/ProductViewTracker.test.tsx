import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductViewTracker } from "@/features/analytics/ProductViewTracker";

describe("ProductViewTracker", () => {
  it("records a product view when the detail page mounts", async () => {
    const trackEvent = vi.fn().mockResolvedValue(undefined);

    render(
      <ProductViewTracker
        productId="product-1"
        shopId="shop-1"
        trackEvent={trackEvent}
      />,
    );

    await waitFor(() => expect(trackEvent).toHaveBeenCalledOnce());
    expect(trackEvent).toHaveBeenCalledWith({
      event: "view_product",
      productId: "product-1",
      shopId: "shop-1",
    });
  });
});
