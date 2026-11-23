import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: (...args: unknown[]) => ({ maybeSingle: () => rpc(...args) }) }) }));
import { POST } from "./route";

const productId = "22222222-2222-4222-8222-222222222222";
const request = (body: unknown) => new Request("https://shop.example/api/promo/quote", { method: "POST", body: JSON.stringify(body) });

describe("promo quote", () => {
  beforeEach(() => rpc.mockReset());
  it("returns the database quote for the normalised code", async () => {
    rpc.mockResolvedValue({ data: { code: "SAVE20", list_cents: 18900, discount_cents: 3700, final_cents: 15200 }, error: null });
    const response = await POST(request({ productId, code: " save20 " }));
    expect(await response.json()).toEqual({ code: "SAVE20", listCents: 18900, discountCents: 3700, finalCents: 15200 });
    expect(rpc).toHaveBeenCalledWith("quote_promo_code", { p_product: productId, p_code: "SAVE20" });
  });
  it("explains a refusal in Thai", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "promo_expired" } });
    const response = await POST(request({ productId, code: "OLD" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "โค้ดนี้หมดอายุแล้ว" });
  });
  it("rejects malformed input without asking the database", async () => {
    expect((await POST(request({ productId: "x", code: "SAVE20" }))).status).toBe(400);
    expect((await POST(request({ productId, code: "a b" }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
