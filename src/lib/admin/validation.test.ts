import { expect, it } from "vitest";
import { assertSameOrigin, parseAdminAction } from "./validation";
it("rejects missing and cross origin mutation requests", () => {
  for (const origin of [null, "https://evil.example"]) {
    const req = new Request("https://buykub.com/api/admin/save-user", { headers: origin ? { origin } : {} });
    expect(() => assertSameOrigin(req)).toThrow();
  }
  expect(() => assertSameOrigin(new Request("https://buykub.com/api/admin/save-user", { headers: { origin: "https://buykub.com" } }))).not.toThrow();
});
it("bounds notes, validates ids and booleans, rejects executable site text", () => {
  expect(() => parseAdminAction("save-user", { userId: "x", note: "", payoutHold: false })).toThrow();
  expect(() => parseAdminAction("set-shop", { id: "b598875b-3672-4af8-8aa0-a121617aa321", published: "true" })).toThrow();
  expect(() => parseAdminAction("save-site", { hero_title: "<script>x</script>", hero_subtitle: "x", announcement: "", support_email: "" })).toThrow();
  expect(() => parseAdminAction("save-user", { userId: "b598875b-3672-4af8-8aa0-a121617aa321", note: "x".repeat(2001), payoutHold: false })).toThrow();
  expect(parseAdminAction("set-product", { id: "b598875b-3672-4af8-8aa0-a121617aa321", published: false })).toMatchObject({ action: "set-product", published: false });
});
it("bounds incoming bytes even when Content-Length is omitted", async () => {
  const { readAdminJson } = await import("./validation");
  await expect(readAdminJson(new Request("https://buykub.com", { method: "POST", headers: { "content-type": "application/json" }, body: '"' + 'x'.repeat(16001) + '"' }))).rejects.toMatchObject({ status: 413 });
  await expect(readAdminJson(new Request("https://buykub.com", { method: "POST", headers: { "content-type": "application/json" }, body: '{"ok":true}' }))).resolves.toEqual({ ok: true });
});
