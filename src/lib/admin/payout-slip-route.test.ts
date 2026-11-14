// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), upload: vi.fn(), url: vi.fn() }));
vi.mock("@/lib/admin/access", () => ({ getAdminContext: m.auth, AdminAccessError: class extends Error { constructor(public status: number) { super("Forbidden"); } } }));
vi.mock("@/lib/payouts/slips", () => ({ uploadPayoutSlip: m.upload, getPayoutSlipUrl: m.url }));
import { GET, POST } from "@/app/api/admin/payout-slip/route";
const batchId = "b598875b-3672-4af8-8aa0-a121617aa321";
beforeEach(() => { vi.resetAllMocks(); m.auth.mockResolvedValue({ user: { id: "verified-admin" } }); });
it("rejects cross-origin uploads before auth or storage calls", async () => {
  const r = await POST(new Request("https://buykub.com/api/admin/payout-slip", { method: "POST", headers: { origin: "https://evil.test" } }));
  expect(r.status).toBe(403); expect(m.upload).not.toHaveBeenCalled(); expect(m.auth).not.toHaveBeenCalled();
});
it("bounds uploads and requires valid multipart with a batch ID", async () => {
  const r = await POST(new Request("https://buykub.com/api/admin/payout-slip", { method: "POST", headers: { origin: "https://buykub.com", "content-type": "multipart/form-data; boundary=abc", "content-length": "6000000" }, body: "x" }));
  expect(r.status).toBe(413); expect(m.upload).not.toHaveBeenCalled();
});
it("routes a bounded file only under the verified actor and never caches", async () => {
  const form = new FormData(); form.append("batchId", batchId); form.append("file", new File(["receipt"], "receipt.pdf", { type: "application/pdf" }));
  m.upload.mockResolvedValue({ attached: true });
  const r = await POST(new Request("https://buykub.com/api/admin/payout-slip", { method: "POST", headers: { origin: "https://buykub.com" }, body: form }));
  expect(r.status).toBe(200); expect(r.headers.get("cache-control")).toContain("no-store");
  expect(m.upload).toHaveBeenCalledWith("verified-admin", batchId, expect.objectContaining({ type: "application/pdf" }));
});
it("requires authorization to obtain private signed URLs and suppresses internal failures", async () => {
  m.auth.mockRejectedValueOnce(new Error("private credentials"));
  const denied = await GET(new Request(`https://buykub.com/api/admin/payout-slip?batchId=${batchId}`));
  expect(denied.status).toBe(503); expect(await denied.text()).not.toContain("credentials"); expect(m.url).not.toHaveBeenCalled();
  m.url.mockResolvedValue({ url: "https://storage.test/signed" });
  const r = await GET(new Request(`https://buykub.com/api/admin/payout-slip?batchId=${batchId}`));
  expect(await r.json()).toEqual({ url: "https://storage.test/signed" }); expect(r.headers.get("cache-control")).toContain("private");
});
