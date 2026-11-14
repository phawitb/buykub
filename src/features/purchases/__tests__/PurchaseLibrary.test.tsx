import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PurchaseLibrary } from "../PurchaseLibrary";
import type { Purchase } from "@/lib/purchases/types";

const purchase = (extra: Partial<Purchase> = {}): Purchase => ({ id: "file", name: "Design guide", shopName: "Studio", kind: "file", status: "paid", priceCents: 12900, purchasedAt: "2026-11-12", expiresAt: null, href: "/checkout/success?session_id=receipt", ...extra });

describe("purchase library", () => {
  it("lists courses, files and keys with the appropriate actions", () => {
    render(<PurchaseLibrary purchases={[purchase(), purchase({ id: "course", name: "Design course", kind: "course", href: "/learn/course" }), purchase({ id: "key", name: "Design license", kind: "key" })]} />);
    expect(screen.getByRole("heading", { name: "รายการที่สั่งซื้อ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เข้าเรียน" })).toHaveAttribute("href", "/learn/course");
    expect(screen.getByRole("link", { name: "เปิดไฟล์ที่ซื้อ" })).toHaveAttribute("href", "/checkout/success?session_id=receipt");
    expect(screen.getByRole("link", { name: "ดูคีย์ที่ซื้อ" })).toBeInTheDocument();
  });
  it("shows revoked purchases as history without content actions", () => {
    render(<PurchaseLibrary purchases={[purchase({ status: "refunded" }), purchase({ id: "course", name: "Expired course", kind: "course", status: "expired", expiresAt: "2020-01-01" })]} />);
    expect(screen.getByText("คืนเงินแล้ว")).toBeInTheDocument();
    expect(screen.getByText("หมดอายุ")).toBeInTheDocument();
    for (const card of screen.getAllByRole("article")) expect(within(card).queryByRole("link")).not.toBeInTheDocument();
  });
  it("explains the empty library for buyers without a shop", () => {
    render(<PurchaseLibrary purchases={[]} />);
    expect(screen.getByText("ยังไม่มีรายการที่สั่งซื้อ")).toBeInTheDocument();
    expect(screen.getByText(/บัญชี Google เดียวกับตอนซื้อ/)).toBeInTheDocument();
  });
  it("shows a retry state instead of claiming an empty library on lookup failure", () => {
    render(<PurchaseLibrary purchases={[]} failed />);
    expect(screen.getByRole("alert")).toHaveTextContent("โหลดรายการที่สั่งซื้อไม่สำเร็จ");
    expect(screen.queryByText("ยังไม่มีรายการที่สั่งซื้อ")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ลองอีกครั้ง" })).toHaveAttribute("href", "/learn");
  });
});
