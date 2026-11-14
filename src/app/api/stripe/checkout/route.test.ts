import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), userRpc: vi.fn(), product: vi.fn(), context: vi.fn(), getUser: vi.fn(),
  create: vi.fn(), confirm: vi.fn(), retrieve: vi.fn(), cleanup: vi.fn(),
  hostedCreate: vi.fn(), hostedRetrieve: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mocks.getUser }, rpc: mocks.userRpc,
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.product }) }) }),
}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  rpc: mocks.rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.context }) }) }),
}) }));
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({
  checkout: { sessions: { create: mocks.hostedCreate, retrieve: mocks.hostedRetrieve } },
  paymentIntents: { create: mocks.create, confirm: mocks.confirm, retrieve: mocks.retrieve },
}) }));
vi.mock("@/lib/payments/promptpay", () => ({ cleanupExpiredPromptpay: mocks.cleanup }));
import { POST } from "./route";

const reference = "11111111-1111-4111-8111-111111111111";
const googleUser = {
  id: "buyer-id", email: "buyer@example.com", email_confirmed_at: "2026-01-01",
  app_metadata: { provider: "google" },
};
const context = {
  checkout_reference: reference, product_id: "22222222-2222-4222-8222-222222222222",
  status: "created", amount_cents: 38900, stripe_session_id: "pp_receipt",
  stripe_payment_intent_id: null, promptpay_buyer_email: "buyer@example.com",
};
function request(extra = {}) {
  return new Request("https://shop.example/api/stripe/checkout", {
    method: "POST", body: JSON.stringify({ kind: "product", productId: context.product_id, requestId: reference, ...extra }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: googleUser }, error: null });
  mocks.product.mockResolvedValue({ data: { delivery_type: "file", name: "Book" } });
  mocks.context.mockResolvedValueOnce({ data: null }).mockResolvedValue({ data: context });
  mocks.userRpc.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.create.mockResolvedValue({ id: "pi_test", status: "requires_confirmation" });
  mocks.confirm.mockResolvedValue({ id: "pi_test", status: "requires_action" });
  mocks.cleanup.mockResolvedValue(undefined);
  mocks.hostedCreate.mockResolvedValue({ id: "cs_free", url: "https://checkout.stripe.com/free" });
});

const productKinds = [
  { deliveryType: "file", amount: 38900 }, { deliveryType: "key", amount: 38900 },
  { deliveryType: "course", amount: 38900 }, { deliveryType: "file", amount: 0 },
  { deliveryType: "key", amount: 0 }, { deliveryType: "course", amount: 0 },
];
describe.each(productKinds)("Google-only $deliveryType checkout (amount $amount)", ({ deliveryType, amount }) => {
  it.each([
    { name: "guests", user: null },
    { name: "non-Google accounts", user: { ...googleUser, app_metadata: { provider: "email" } } },
    { name: "unconfirmed Google email", user: { ...googleUser, email_confirmed_at: null } },
  ])("rejects $name before reservations or payment mutations", async ({ user }) => {
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });
    mocks.product.mockResolvedValue({ data: { delivery_type: deliveryType } });
    mocks.context.mockReset().mockResolvedValue({ data: { ...context, amount_cents: amount } });
    const response = await POST(request({ buyerEmail: "forged@example.com" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "google_login_required" });
    expect(mocks.cleanup).not.toHaveBeenCalled();
    expect(mocks.context).not.toHaveBeenCalled();
    expect(mocks.userRpc).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.hostedCreate).not.toHaveBeenCalled();
  });

  it("ignores forged buyerEmail and uses the normalized verified Google email", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { ...googleUser, email: "  Verified@Example.COM  " } }, error: null });
    mocks.product.mockResolvedValue({ data: { delivery_type: deliveryType } });
    mocks.context.mockReset().mockResolvedValueOnce({ data: null }).mockResolvedValue({ data: {
      ...context, amount_cents: amount, stripe_session_id: amount === 0 ? null : "pp_receipt", promptpay_buyer_email: "verified@example.com",
    } });
    const response = await POST(request({ buyerEmail: "forged@example.com" }));
    expect(response.status).toBe(200);
    if (amount === 0) {
      expect(mocks.hostedCreate).toHaveBeenCalledWith(expect.objectContaining({
        customer_email: "verified@example.com", mode: "payment",
        line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 0, currency: "thb" }) })],
      }), { idempotencyKey: `free-checkout-${reference}` });
      expect(mocks.hostedCreate.mock.calls[0][0]).not.toHaveProperty("payment_method_collection");
      expect(mocks.create).not.toHaveBeenCalled();
    } else {
      expect(mocks.rpc).toHaveBeenCalledWith("prepare_promptpay_checkout", { p_checkout_reference: reference, p_email: "verified@example.com" });
      expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
        receipt_email: "verified@example.com", payment_method_data: { type: "promptpay", billing_details: { email: "verified@example.com" } },
      }), { idempotencyKey: `promptpay-create-${reference}` });
    }
  });
});

describe("PromptPay checkout start", () => {
  it("rejects a failed session verification even when it includes user data", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: googleUser }, error: new Error("Invalid session") });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.userRpc).not.toHaveBeenCalled();
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "invalid-email"])("rejects a Google account without a usable email (%s)", async (email) => {
    mocks.getUser.mockResolvedValue({ data: { user: { ...googleUser, email } }, error: null });
    const response = await POST(request({ buyerEmail: "forged@example.com" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "google_login_required" });
    expect(mocks.userRpc).not.toHaveBeenCalled();
  });
  it("creates THB PromptPay only and binds the intent before confirmation", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "/checkout/promptpay/pp_receipt" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ currency: "thb", payment_method_types: ["promptpay"], amount: 38900 }), { idempotencyKey: `promptpay-create-${reference}` });
    expect(mocks.rpc).toHaveBeenCalledWith("attach_promptpay_intent", { p_checkout_reference: reference, p_payment_intent_id: "pi_test" });
    expect(mocks.rpc.mock.invocationCallOrder.at(-1)).toBeLessThan(mocks.confirm.mock.invocationCallOrder[0]);
  });
  it("reuses an existing QR on retry without reserving, confirming or creating another charge", async () => {
    mocks.context.mockReset().mockResolvedValue({ data: { ...context, stripe_payment_intent_id: "pi_existing" } });
    mocks.retrieve.mockResolvedValue({ id: "pi_existing", status: "requires_action" });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.userRpc).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("does not release a reservation after an ambiguous confirmation timeout", async () => {
    mocks.confirm.mockRejectedValue(new Error("timeout"));
    expect((await POST(request())).status).toBe(502);
    expect(mocks.rpc).not.toHaveBeenCalledWith("cancel_stripe_checkout", expect.anything());
  });
  it("rejects a retry owned by another buyer", async () => {
    mocks.context.mockReset().mockResolvedValue({ data: { ...context, promptpay_buyer_email: "other@example.com" } });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.userRpc).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("reuses a free checkout session on retry", async () => {
    mocks.context.mockReset().mockResolvedValue({ data: { ...context, amount_cents: 0, stripe_session_id: "cs_existing" } });
    mocks.hostedRetrieve.mockResolvedValue({ id: "cs_existing", url: "https://checkout.stripe.com/existing" });
    expect(await (await POST(request())).json()).toEqual({ url: "https://checkout.stripe.com/existing" });
    expect(mocks.hostedCreate).not.toHaveBeenCalled();
    expect(mocks.userRpc).not.toHaveBeenCalled();
  });
});
