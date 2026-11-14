import { describe, expect, it } from "vitest";
import { buildCourseEmail, buildProductKeyEmail } from "./email";

it('sends course access through Google login without exposing document or session capabilities', () => {
  const mail = buildCourseEmail({shopName:'<School>',productName:'Course & Notes',orderId:'12345678-abcd',productId:'12345678-1234-4123-8123-123456789abc',expiresAt:null});
  expect(mail.text).toContain('https://buykub.com/learn/12345678-1234-4123-8123-123456789abc');
  expect(mail.text).toContain('Google');
  expect(mail.text).toContain('ตลอดไป');
  expect(mail.html).toContain('&lt;School&gt;');
  expect(mail.html).not.toContain('<School>');
  expect(mail.text).not.toContain('session_id');
});

it('includes the purchased course expiry in its receipt', () => {
  const mail = buildCourseEmail({shopName:'School',productName:'Course',orderId:'12345678',productId:'product',expiresAt:'2026-12-12T10:00:00Z'});
  expect(mail.text).toContain('2026-12-12T10:00:00Z');
  expect(mail.text).not.toContain('ตลอดไป');
});

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

it('creates an escaped file receipt with a persistent checkout link', async () => {
  const { buildProductFileEmail } = await import('./email');
  const mail = buildProductFileEmail({shopName:'<shop>',productName:'Guide & PDF',orderId:'12345678-abcd',sessionId:'cs_test_paid'});
  expect(mail.text).toContain('https://buykub.com/checkout/success?session_id=cs_test_paid');
  expect(mail.html).toContain('href="https://buykub.com/checkout/success?session_id=cs_test_paid"');
  expect(mail.html).toContain('&lt;shop&gt;');
  expect(mail.html).not.toContain('<shop>');
  expect(mail.text).not.toContain('storage');
});
