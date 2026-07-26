import { describe, expect, it } from "vitest";
import { buildProductKeyEmail } from "./email";

describe("buildProductKeyEmail", () => {
  it("uses BUYKUB identity without the legacy brand", () => {
    const email = buildProductKeyEmail({
      shopName: "BUYKUB Demo",
      productName: "Windows Key",
      orderId: "12345678-abcd",
      keyValue: "AAAA-BBBB-CCCC",
    });

    expect(email.html).toContain("BUYKUB");
    expect(email.html).not.toMatch(/FRAMELINK|Framelink/);
  });

  it("includes the product, shop, order reference and key in both formats", () => {
    const email = buildProductKeyEmail({
      shopName: "Framelink Demo",
      productName: "Windows Key",
      orderId: "12345678-abcd",
      keyValue: "AAAA-BBBB-CCCC",
    });

    expect(email.subject).toContain("Windows Key");
    expect(email.text).toContain("AAAA-BBBB-CCCC");
    expect(email.text).toContain("12345678");
    expect(email.html).toContain("AAAA-BBBB-CCCC");
  });

  it("escapes untrusted values in HTML", () => {
    const email = buildProductKeyEmail({
      shopName: "<script>alert(1)</script>",
      productName: "A&B",
      orderId: "order",
      keyValue: "<KEY>",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;KEY&gt;");
    expect(email.html).toContain("A&amp;B");
  });
});
