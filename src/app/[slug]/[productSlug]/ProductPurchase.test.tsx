import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductPurchase } from "./ProductPurchase";

const { getUser, rpc } = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getUser }, rpc }) }));
const product = { id: "course-123", shopId: "shop-123", name: "Course", priceCents: 38900, deliveryType: "course" as const };

beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true; } },
    close: { configurable: true, value() { this.open = false; this.dispatchEvent(new Event("close")); } },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("ProductPurchase", () => {
  it("offers the same buy button and Google dialog to course guests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ code: "google_login_required" }) }));
    render(<ProductPurchase product={product} />);
    await userEvent.click(await screen.findByRole("button", { name: "ซื้อเลย ฿389" }));
    expect(await screen.findByRole("dialog", { name: "เข้าสู่ระบบก่อนซื้อ" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps the learn link for a verified Google customer with course access", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-123", app_metadata: { provider: "google" } } }, error: null });
    rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    render(<ProductPurchase product={product} />);
    expect(await screen.findByRole("link", { name: /เข้าเรียนคอร์สนี้/ })).toHaveAttribute("href", "/learn/course-123");
    expect(rpc).toHaveBeenCalledWith("course_access", { p_product_id: "course-123" });
    expect(screen.queryByRole("button", { name: /ซื้อเลย/ })).not.toBeInTheDocument();
  });

  it("tells a buyer they own the course and offers its PDF next to the learn link", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-123", app_metadata: { provider: "google" } } }, error: null });
    rpc.mockResolvedValue({ data: { allowed: true, reason: "active", expires_at: "2026-12-21T10:00:00Z" }, error: null });
    render(<ProductPurchase product={{ ...product, hasPdf: true }} />);
    expect(await screen.findByText(/คุณมีสิทธิ์เข้าเรียนคอร์สนี้แล้ว · ถึง 21 ธ\.ค\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิด PDF ประกอบคอร์ส" })).toHaveAttribute("href", "/learn/course-123/pdf");
  });

  it("leaves out the PDF button for a course without a PDF", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-123", app_metadata: { provider: "google" } } }, error: null });
    rpc.mockResolvedValue({ data: { allowed: true, reason: "owner", expires_at: null }, error: null });
    render(<ProductPurchase product={product} />);
    expect(await screen.findByText("คอร์สของร้านคุณ เข้าดูได้ทุกเมื่อ")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "เปิด PDF ประกอบคอร์ส" })).toBeNull();
  });

  it("offers purchase when a verified Google customer has no course access", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-123", app_metadata: { provider: "google" } } }, error: null });
    rpc.mockResolvedValue({ data: { allowed: false }, error: null });
    render(<ProductPurchase product={product} />);
    expect(await screen.findByRole("button", { name: "ซื้อเลย ฿389" })).toBeEnabled();
  });

  it.each(["file", "key"] as const)("does not add an auth request before %s checkout", (deliveryType) => {
    render(<ProductPurchase product={{ ...product, deliveryType, availableStock: 1 }} />);
    expect(screen.getByRole("button", { name: "ซื้อเลย ฿389" })).toBeEnabled();
    expect(getUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
