import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ apply: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/admin/service", () => ({ applyAdminAction: mocks.apply }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidate, unstable_cache: (fn: unknown) => fn }));
import { POST, GET } from "@/app/api/admin/[action]/route";
import { AdminAccessError } from "./access";
const context = { params: Promise.resolve({ action: "set-product" }) };
const request = (origin = "https://buykub.com") => new Request("https://buykub.com/api/admin/set-product", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ id: "b598875b-3672-4af8-8aa0-a121617aa321", published: false }) });
beforeEach(() => vi.clearAllMocks());
it("rejects cross-origin requests before any admin mutation and never caches", async () => {
  const response = await POST(request("https://evil.example"), context);
  expect(response.status).toBe(403);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(mocks.apply).not.toHaveBeenCalled();
});
it("returns a private unauthorized response and invalidates only successful mutations", async () => {
  mocks.apply.mockRejectedValueOnce(new AdminAccessError(403));
  const denied = await POST(request(), context);
  expect(denied.status).toBe(403);
  expect(denied.headers.get("cache-control")).toContain("private");
  expect(mocks.revalidate).not.toHaveBeenCalled();
  mocks.apply.mockResolvedValueOnce("set-product");
  const success = await POST(request(), context);
  expect(await success.json()).toEqual({ ok: true });
  expect(mocks.revalidate).toHaveBeenCalledTimes(1);
});
it("does not leak database failures and disallows GET", async () => {
  mocks.apply.mockRejectedValueOnce(new Error("secret bank data"));
  const response = await POST(request(), context);
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("secret");
  expect(GET().status).toBe(405);
  expect(GET().headers.get("cache-control")).toContain("no-store");
});
