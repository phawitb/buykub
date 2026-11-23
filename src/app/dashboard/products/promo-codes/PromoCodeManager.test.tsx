import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromoCodeManager, type PromoCodeRow } from "./PromoCodeManager";

const db = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      insert: (row: unknown) => ({ select: () => ({ single: () => db.insert(row) }) }),
      update: (patch: unknown) => ({ eq: () => db.update(patch) }),
      delete: () => ({ eq: () => db.remove() }),
    }),
  }),
}));

const products = [
  { id: "p1", name: "คอร์ส 30 วัน", price_cents: 18900 },
  { id: "p2", name: "คอร์ส 7 วัน", price_cents: 8900 },
];
const existing: PromoCodeRow = {
  id: "c1", code: "WELCOME", percent_off: null, amount_off_cents: 5000, product_ids: ["p1"], max_redemptions: 100,
  once_per_user: true, expires_at: "2026-12-31T16:59:59Z", active: true, created_at: "2026-11-23", paid_uses: 3,
};

describe("PromoCodeManager", () => {
  beforeEach(() => { db.insert.mockReset(); db.update.mockReset(); db.remove.mockReset(); });

  it("lists a code with its discount and limits", () => {
    render(<PromoCodeManager shopId="s1" initialCodes={[existing]} products={products} />);
    const item = screen.getByRole("listitem");
    expect(within(item).getByText("WELCOME")).toBeInTheDocument();
    expect(within(item).getByText("ลด ฿50")).toBeInTheDocument();
    expect(item).toHaveTextContent("คอร์ส 30 วัน · ใช้แล้ว 3 / 100 ครั้ง · ถึง 31 ธ.ค. 2569 · 1 ครั้งต่อบัญชี");
  });

  it("creates a percent code for chosen products", async () => {
    db.insert.mockImplementation(async (row) => ({ data: { id: "c2", created_at: "2026-11-23", active: true, ...row }, error: null }));
    const user = userEvent.setup();
    render(<PromoCodeManager shopId="s1" initialCodes={[]} products={products} />);
    await user.type(screen.getByLabelText("โค้ด"), "save20");
    await user.type(screen.getByLabelText("ลดกี่เปอร์เซ็นต์"), "20");
    await user.click(screen.getByLabelText("เลือกสินค้า"));
    await user.click(screen.getByLabelText(/คอร์ส 7 วัน/));
    await user.type(screen.getByLabelText("จำนวนครั้งที่ใช้ได้ทั้งหมด"), "50");
    await user.click(screen.getByRole("button", { name: "สร้างโค้ด" }));
    expect(db.insert).toHaveBeenCalledWith({
      shop_id: "s1", code: "SAVE20", percent_off: 20, amount_off_cents: null, product_ids: ["p2"],
      max_redemptions: 50, once_per_user: true, expires_at: null,
    });
    expect(await screen.findByText("SAVE20")).toBeInTheDocument();
  });

  it("refuses a percent over 100 before saving", async () => {
    const user = userEvent.setup();
    render(<PromoCodeManager shopId="s1" initialCodes={[]} products={products} />);
    await user.type(screen.getByLabelText("โค้ด"), "BIG");
    await user.type(screen.getByLabelText("ลดกี่เปอร์เซ็นต์"), "150");
    await user.click(screen.getByRole("button", { name: "สร้างโค้ด" }));
    expect(screen.getByRole("alert")).toHaveTextContent("ลดได้ไม่เกิน 100%");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("says when the code already exists", async () => {
    db.insert.mockResolvedValue({ data: null, error: { code: "23505" } });
    const user = userEvent.setup();
    render(<PromoCodeManager shopId="s1" initialCodes={[]} products={products} />);
    await user.type(screen.getByLabelText("โค้ด"), "WELCOME");
    await user.click(screen.getByRole("radio", { name: "บาท" }));
    await user.type(screen.getByLabelText("ลดกี่บาท"), "50");
    await user.click(screen.getByRole("button", { name: "สร้างโค้ด" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("มีโค้ดนี้ในร้านแล้ว");
  });

  it("turns a code off and deletes it after a second click", async () => {
    db.update.mockResolvedValue({ error: null });
    db.remove.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<PromoCodeManager shopId="s1" initialCodes={[existing]} products={products} />);
    await user.click(screen.getByRole("button", { name: "ปิดใช้งาน" }));
    expect(db.update).toHaveBeenCalledWith({ active: false });
    expect(await screen.findByText("ปิดอยู่")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ลบ" }));
    expect(db.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "ยืนยันลบ" }));
    expect(db.remove).toHaveBeenCalled();
    expect(await screen.findByText("ยังไม่มีโค้ดส่วนลด")).toBeInTheDocument();
  });
});
