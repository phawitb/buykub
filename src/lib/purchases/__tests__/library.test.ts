import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ context: vi.fn(), admin: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/seller-context", () => ({ getSellerContext: mocks.context }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
import { getPurchaseLibrary, getShopTryouts } from "../library";

const receipt = "pp_12345678-1234-1234-1234-123456789012";
const user = { id: "buyer", email: "buyer@example.com", email_confirmed_at: "2026-01-01", app_metadata: { provider: "google" } };
const order = (extra = {}) => ({ id: "order", product_id: "product", buyer_user_id: "buyer", buyer_email: "buyer@example.com", course_purchase: false, course_expires_at: null, status: "paid", paid_at: "2026-01-01", created_at: "2026-01-01", price_cents: 12900, stripe_checkout_session_id: receipt, products: { name: "Guide", delivery_type: "file" }, shops: { name: "Shop" }, ...extra });
function query(data: unknown[], error: unknown = null) {
  const builder = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn(), range: vi.fn() };
  builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder); builder.is.mockReturnValue(builder); builder.order.mockReturnValue(builder);
  builder.range.mockResolvedValue({ data, error });
  return builder;
}
function database(linked = [order()], legacy: ReturnType<typeof order>[] = []) {
  const queries = [query(linked), query(legacy)];
  const from = vi.fn().mockReturnValueOnce(queries[0]).mockReturnValueOnce(queries[1]);
  mocks.admin.mockReturnValue({ from });
  return { queries, from };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ user, supabase: { rpc: mocks.rpc } });
  mocks.rpc.mockResolvedValue({ data: { allowed: true, reason: "active", expires_at: null }, error: null });
});

describe("purchase library authorization", () => {
  it("requires authoritative authentication before constructing the admin client", async () => {
    mocks.context.mockRejectedValue(new Error("redirect:/login"));
    await expect(getPurchaseLibrary()).rejects.toThrow("redirect:/login");
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("scopes owner and legacy reads separately without a raw PostgREST expression", async () => {
    const { queries } = database();
    await getPurchaseLibrary();
    expect(queries[0].eq).toHaveBeenCalledWith("buyer_user_id", "buyer");
    expect(queries[1].is).toHaveBeenCalledWith("buyer_user_id", null);
    expect(queries[1].eq).toHaveBeenCalledWith("course_purchase", false);
    expect(queries[1].eq).toHaveBeenCalledWith("buyer_email", "buyer@example.com");
  });
  it("never uses unconfirmed or editable profile email for legacy access", async () => {
    mocks.context.mockResolvedValue({ user: { ...user, email_confirmed_at: null, user_metadata: { email: "victim@example.com", email_verified: true } }, supabase: { rpc: mocks.rpc } });
    const { from } = database();
    await getPurchaseLibrary();
    expect(from).toHaveBeenCalledTimes(1);
  });
  it("treats filter punctuation as an exact email value", async () => {
    const email = "buyer+(),*@example.com";
    mocks.context.mockResolvedValue({ user: { ...user, email }, supabase: { rpc: mocks.rpc } });
    const { queries } = database();
    await getPurchaseLibrary();
    expect(queries[1].eq).toHaveBeenCalledWith("buyer_email", email);
  });
  it("normalizes the confirmed auth email to match checkout storage before exact comparison", async () => {
    mocks.context.mockResolvedValue({ user: { ...user, email: " Buyer@Example.COM " }, supabase: { rpc: mocks.rpc } });
    const { queries } = database([], [order({ buyer_user_id: null })]);
    const purchases = await getPurchaseLibrary();
    expect(queries[1].eq).toHaveBeenCalledWith("buyer_email", "buyer@example.com");
    expect(purchases).toHaveLength(1);
    expect(purchases[0].href).toBe(`/checkout/success?session_id=${receipt}`);
  });
  it("rejects another user's orders, email mismatches and email-matched courses", async () => {
    database([order({ buyer_user_id: "other" })], [order({ id: "other", buyer_user_id: null, buyer_email: "other@example.com" }), order({ id: "course", buyer_user_id: null, course_purchase: true })]);
    expect(await getPurchaseLibrary()).toEqual([]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("projects display data and paid receipt links without private fields", async () => {
    database([], [order({ buyer_user_id: null, private_file_path: "secret", key_value: "secret", delivery_token: "secret" })]);
    const list = await getPurchaseLibrary();
    expect(list[0]).toEqual({ id: "order", name: "Guide", shopName: "Shop", kind: "file", priceCents: 12900, purchasedAt: "2026-01-01", status: "paid", expiresAt: null, href: `/checkout/success?session_id=${receipt}` });
    expect(JSON.stringify(list)).not.toContain("secret");
    expect(JSON.stringify(list)).not.toContain("buyer@example.com");
  });
  it("checks course entitlement with the user client before offering a classroom link", async () => {
    database([order({ course_purchase: true, products: { name: "Course", delivery_type: "course" } })]);
    expect((await getPurchaseLibrary())[0].href).toBe("/learn/product");
    expect(mocks.rpc).toHaveBeenCalledWith("course_access", { p_product_id: "product" });
  });
  it("offers a course's PDF only with an open classroom, never exposing its storage path", async () => {
    database([
      order({ id: "open", course_purchase: true, products: { name: "Course", delivery_type: "course", file_path: "seller/course.pdf" } }),
      order({ id: "expired", course_purchase: true, course_expires_at: "2020-01-01", products: { name: "Course", delivery_type: "course", file_path: "seller/course.pdf" } }),
    ]);
    const list = await getPurchaseLibrary();
    expect(list.map(item => item.pdfHref)).toEqual(["/api/courses/product/pdf", null]);
    expect(JSON.stringify(list)).not.toContain("seller/course.pdf");
  });
  it("keeps refunded and expired history without content links, including repurchases", async () => {
    database([order({ id: "refund", status: "refunded" }), order({ id: "expiry", course_purchase: true, course_expires_at: "2020-01-01", products: { name: "Course", delivery_type: "course" } })]);
    const list = await getPurchaseLibrary();
    expect(list.map(item => item.href)).toEqual([null, null]);
    expect(list.map(item => item.status)).toEqual(["refunded", "expired"]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not grant a denied course or a pending order", async () => {
    database([order({ course_purchase: true, products: { name: "Course", delivery_type: "course" } }), order({ id: "pending", status: "pending" })]);
    mocks.rpc.mockResolvedValue({ data: { allowed: false, reason: "not_purchased" }, error: null });
    expect((await getPurchaseLibrary()).every(item => item.href === null)).toBe(true);
  });
  it("fails closed on order lookup or entitlement errors", async () => {
    const { queries } = database();
    queries[1].range.mockResolvedValue({ data: null, error: new Error("offline") });
    await expect(getPurchaseLibrary()).rejects.toThrow("โหลดรายการที่สั่งซื้อไม่สำเร็จ");
    database([order({ course_purchase: true, products: { name: "Course", delivery_type: "course" } })]);
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("offline") });
    await expect(getPurchaseLibrary()).rejects.toThrow("ตรวจสอบสิทธิ์เข้าเรียนไม่สำเร็จ");
  });
});

describe("products from the seller's own shop", () => {
  function shopQuery(data: unknown[], error: unknown = null) {
    const builder = { select: vi.fn(), eq: vi.fn(), order: vi.fn() } as Record<string, ReturnType<typeof vi.fn>> & { then?: unknown };
    for (const key of ["select", "eq", "order"]) builder[key].mockReturnValue(builder);
    builder.then = (resolve: (value: unknown) => unknown) => resolve({ data, error });
    return builder;
  }
  it("is empty for buyers without a shop", async () => {
    mocks.context.mockResolvedValue({ user, supabase: {}, shop: null });
    expect(await getShopTryouts()).toEqual([]);
  });
  it("opens courses through the classroom, files through the owner route and keys in the dashboard, never exposing file paths", async () => {
    const products = shopQuery([
      { id: "c", name: "Course", delivery_type: "course", file_path: "buyer/course.pdf", published: true, images_v2: [{ publicUrl: "https://cdn/c.webp" }] },
      { id: "f", name: "File", delivery_type: "file", file_path: "buyer/secret.pdf", published: false },
      { id: "e", name: "Empty", delivery_type: "file", file_path: null, published: true },
      { id: "k", name: "Key", delivery_type: "key", file_path: null, published: true, images: ["https://cdn/k.png"] },
    ]);
    mocks.context.mockResolvedValue({ user, supabase: { from: vi.fn(() => products) }, shop: { id: "shop" } });
    mocks.admin.mockReturnValue({ from: vi.fn(() => ({ select: () => ({ in: async () => ({ data: [], error: null }), eq: () => ({ in: async () => ({ data: [], error: null }) }) }) })) });
    const tryouts = await getShopTryouts();
    expect(products.eq).toHaveBeenCalledWith("shop_id", "shop");
    expect(tryouts.map(t => [t.id, t.kind, t.href, t.published])).toEqual([
      ["c", "course", "/learn/c", true], ["f", "file", "/api/products/f/file", false], ["e", "file", null, true], ["k", "key", "/dashboard/products/k/edit", true],
    ]);
    expect(tryouts[0].pdfHref).toBe("/api/courses/c/pdf");
    expect(tryouts.map(t => t.coverUrl)).toEqual(["https://cdn/c.webp", null, null, "https://cdn/k.png"]);
    expect(JSON.stringify(tryouts)).not.toMatch(/secret\.pdf|course\.pdf/);
  });
});
