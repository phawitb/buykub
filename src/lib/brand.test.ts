import { describe, expect, it } from "vitest";
import {
  BRAND_DOMAIN,
  BRAND_NAME,
  BRAND_ORIGIN,
  ORDER_EMAIL,
  SUPPORT_EMAIL,
  productUrl,
  shopUrl,
} from "./brand";

describe("brand contract", () => {
  it("exposes BUYKUB production identity", () => {
    expect(BRAND_NAME).toBe("BUYKUB");
    expect(BRAND_DOMAIN).toBe("buykub.com");
    expect(BRAND_ORIGIN).toBe("https://buykub.com");
    expect(SUPPORT_EMAIL).toBe("support@buykub.com");
    expect(ORDER_EMAIL).toBe("orders@notify.buykub.com");
  });

  it("builds canonical encoded shop and product URLs", () => {
    expect(shopUrl("phawitboo")).toBe("https://buykub.com/phawitboo");
    expect(shopUrl("/ร้าน ไทย/")).toBe(
      "https://buykub.com/%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%99%20%E0%B9%84%E0%B8%97%E0%B8%A2",
    );
    expect(productUrl("phawitboo", "starter key")).toBe(
      "https://buykub.com/phawitboo/starter%20key",
    );
  });
});
