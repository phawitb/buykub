import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ rpc }) }));
import { GET } from "./route";

const open = (code: string) => GET(new Request(`https://buykub.com/r/${code}`), { params: Promise.resolve({ code }) });

describe("referral link", () => {
  beforeEach(() => { rpc.mockReset(); });
  it("remembers the code for 30 days and opens the product page", async () => {
    rpc.mockResolvedValue({ data: [{ shop_slug: "mysheet", product_slug: "nst-30" }], error: null });
    const response = await open("ABCDE12345");
    expect(rpc).toHaveBeenCalledWith("resolve_affiliate_code", { p_code: "abcde12345" });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://buykub.com/mysheet/nst-30");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("bk_ref=abcde12345");
    expect(cookie).toMatch(/Max-Age=2592000/i);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("sends unknown or malformed codes home without a cookie", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    for (const code of ["abcde12345", "short", "../../etc"]) {
      const response = await open(code);
      expect(response.headers.get("location")).toBe("https://buykub.com/");
      expect(response.headers.get("set-cookie")).toBeNull();
    }
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
