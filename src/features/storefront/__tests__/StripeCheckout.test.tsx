import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StripeCheckout } from "@/features/storefront/StripeCheckout";

const { signInWithOAuth } = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}));

beforeEach(() => {
  signInWithOAuth.mockReset().mockResolvedValue({ data: { provider: "google", url: "https://google.test/oauth" }, error: null });
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true; } },
    close: { configurable: true, value() { this.open = false; this.dispatchEvent(new Event("close")); } },
  });
});

const product = {
  id: "product-123",
  shopId: "shop-123",
  name: "E-Book + Audio Book",
  priceCents: 38900,
  deliveryType: "file" as const,
};

afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

describe("StripeCheckout", () => {
  it("keeps the login dialog open after Strict Mode replays effects", async () => {
    const queuedCloseEvents: (() => void)[] = [];
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
        queuedCloseEvents.push(() => this.dispatchEvent(new Event("close")));
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ code: "google_login_required" }) }));
    const user = userEvent.setup();
    render(<StrictMode><StripeCheckout product={product} /></StrictMode>);
    await user.click(screen.getByRole("button", { name: "ซื้อเลย ฿389" }));
    await screen.findByRole("dialog");
    expect(queuedCloseEvents).toHaveLength(1);
    act(() => queuedCloseEvents.splice(0).forEach((dispatch) => dispatch()));
    expect(screen.getByRole("dialog", { name: "เข้าสู่ระบบก่อนซื้อ" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "ปิด" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a server-created Stripe Checkout URL", async () => {
    const user = userEvent.setup();
    const redirectToCheckout = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://checkout.stripe.test/cs_test_123" }),
    }));
    render(<StripeCheckout product={product} redirectToCheckout={redirectToCheckout} />);
    await user.click(screen.getByRole("button", { name: "ซื้อเลย ฿389" }));
    expect(fetch).toHaveBeenCalledWith("/api/stripe/checkout", expect.objectContaining({ method: "POST" }));
    expect(redirectToCheckout).toHaveBeenCalledWith("https://checkout.stripe.test/cs_test_123");
    vi.unstubAllGlobals();
  });

  it.each(["file", "key", "course"] as const)("opens Google login on the product page for %s guests", async (deliveryType) => {
    window.history.replaceState(null, "", "/my-shop/my-product?campaign=test");
    const user = userEvent.setup();
    const redirectToCheckout = vi.fn();
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ code: "google_login_required" }) });
    vi.stubGlobal("fetch", fetcher);
    render(<StripeCheckout product={{ ...product, deliveryType, availableStock: 2 }} redirectToCheckout={redirectToCheckout} />);
    await user.click(screen.getByRole("button", { name: "ซื้อเลย ฿389" }));
    const dialog = await screen.findByRole("dialog", { name: "เข้าสู่ระบบก่อนซื้อ" });
    expect(redirectToCheckout).not.toHaveBeenCalled();
    expect(screen.queryByText("เข้าสู่ระบบด้วย Google ก่อนซื้อสินค้า โดยใช้อีเมลบัญชี Google รับสินค้าและใบเสร็จ")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "เข้าสู่ระบบด้วย Google" }));
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=%2Fmy-shop%2Fmy-product%3Fcampaign%3Dtest` },
    });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    const checkout = fetcher.mock.calls.find(([url]) => url === "/api/stripe/checkout");
    expect(JSON.parse(checkout![1].body)).not.toHaveProperty("buyerEmail");
  });

  it.each(["close", "escape"])("restores the buy button after %s and allows another attempt", async (method) => {
    const user = userEvent.setup();
    const redirectToCheckout = vi.fn();
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ code: "google_login_required" }) });
    vi.stubGlobal("fetch", fetcher);
    render(<StripeCheckout product={product} redirectToCheckout={redirectToCheckout} />);
    const buy = screen.getByRole("button", { name: "ซื้อเลย ฿389" });
    await user.click(buy);
    const dialog = await screen.findByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "ปิด" });
    expect(close).toHaveFocus();
    if (method === "close") await user.click(close);
    else fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(buy).toBeEnabled();
    expect(buy).toHaveFocus();
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ url: "/checkout/promptpay/receipt" }) });
    await user.click(buy);
    expect(redirectToCheckout).toHaveBeenCalledWith("/checkout/promptpay/receipt");
  });

  it("allows retrying Google login after an OAuth error", async () => {
    const user = userEvent.setup();
    signInWithOAuth.mockResolvedValue({ data: { provider: "google", url: null }, error: new Error("Unavailable") });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ code: "google_login_required" }) }));
    render(<StripeCheckout product={product} />);
    await user.click(screen.getByRole("button", { name: "ซื้อเลย ฿389" }));
    const dialog = await screen.findByRole("dialog");
    const login = within(dialog).getByRole("button", { name: "เข้าสู่ระบบด้วย Google" });
    await user.click(login);
    expect(await within(dialog).findByRole("alert")).not.toBeEmptyDOMElement();
    expect(login).toBeEnabled();
    signInWithOAuth.mockReturnValue(new Promise(() => {}));
    await user.click(login);
    expect(login).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "ปิด" }));
    await user.click(screen.getByRole("button", { name: "ซื้อเลย ฿389" }));
    expect(within(await screen.findByRole("dialog")).getByRole("button", { name: "เข้าสู่ระบบด้วย Google" })).toBeEnabled();
  });

  it("retries the same checkout request after an ambiguous payment failure", async () => {
    const user = userEvent.setup();
    const redirectToCheckout = vi.fn();
    const fetcher = vi.fn().mockImplementation(async (url: string) => url === "/api/stripe/checkout"
      ? ({ ok: false, json: async () => ({ error: "Please try again" }) })
      : ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetcher);
    render(<StripeCheckout product={product} redirectToCheckout={redirectToCheckout} />);
    await user.click(screen.getByRole("button", { name: "ซื้อเลย ฿389" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again");
    fetcher.mockImplementation(async () => ({ ok: true, json: async () => ({ url: "/checkout/promptpay/pp_receipt" }) }));
    await user.click(screen.getByRole("button", { name: "ซื้อเลย ฿389" }));
    const requests = fetcher.mock.calls.filter(([url]) => url === "/api/stripe/checkout");
    expect(JSON.parse(requests[1][1].body).requestId).toBe(JSON.parse(requests[0][1].body).requestId);
    expect(redirectToCheckout).toHaveBeenCalledWith("/checkout/promptpay/pp_receipt");
  });

  it("disables checkout when a key product is sold out", () => {
    render(<StripeCheckout product={{ ...product, deliveryType: "key", availableStock: 0 }} />);
    expect(screen.getByRole("button", { name: "สินค้าหมด" })).toBeDisabled();
  });

  it("applies a promo code, shows the new price and sends the code to checkout", async () => {
    const fetchMock = vi.fn(async (...[url]: [string, RequestInit?]) => url === "/api/promo/quote"
      ? { ok: true, json: async () => ({ code: "SAVE20", listCents: 38900, discountCents: 7700, finalCents: 31200 }) }
      : { ok: true, json: async () => ({ url: "/checkout/promptpay/pp_1" }) });
    vi.stubGlobal("fetch", fetchMock);
    const redirect = vi.fn();
    const user = userEvent.setup();
    render(<StripeCheckout product={product} redirectToCheckout={redirect} />);
    await user.click(screen.getByRole("button", { name: "มีโค้ดส่วนลด?" }));
    await user.type(screen.getByLabelText("โค้ดส่วนลด"), "save20");
    await user.click(screen.getByRole("button", { name: "ใช้โค้ด" }));
    expect(await screen.findByText(/ลด ฿77/)).toBeInTheDocument();
    const buy = screen.getByRole("button", { name: /ซื้อเลย ฿312/ });
    await user.click(buy);
    const checkoutBody = JSON.parse(String(fetchMock.mock.calls.find(([url]) => url === "/api/stripe/checkout")?.[1]?.body));
    expect(checkoutBody).toMatchObject({ promoCode: "SAVE20" });
    expect(redirect).toHaveBeenCalledWith("/checkout/promptpay/pp_1");
  });

  it("shows why a code was refused and keeps the normal price", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "โค้ดนี้หมดอายุแล้ว" }) }));
    const user = userEvent.setup();
    render(<StripeCheckout product={product} />);
    await user.click(screen.getByRole("button", { name: "มีโค้ดส่วนลด?" }));
    await user.type(screen.getByLabelText("โค้ดส่วนลด"), "OLD10");
    await user.click(screen.getByRole("button", { name: "ใช้โค้ด" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("โค้ดนี้หมดอายุแล้ว");
    expect(screen.getByRole("button", { name: /ซื้อเลย ฿389/ })).toBeInTheDocument();
  });

  it("fills in a code from the link", async () => {
    window.history.replaceState(null, "", "/shop/book?code=save20");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: "SAVE20", listCents: 38900, discountCents: 7700, finalCents: 31200 }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<StripeCheckout product={product} />);
    expect(await screen.findByRole("button", { name: /ซื้อเลย ฿312/ })).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ productId: "product-123", code: "SAVE20" });
  });
});
