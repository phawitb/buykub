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
  it("links the shop name to its storefront while the shop is published", () => {
    render(<PurchaseLibrary purchases={[purchase({ shopHref: "/studio" }), purchase({ id: "closed", name: "Old guide", shopName: "Closed shop" })]} />);
    expect(screen.getByRole("link", { name: "ไปหน้าร้าน Studio" })).toHaveAttribute("href", "/studio");
    expect(screen.queryByRole("link", { name: "Closed shop" })).toBeNull();
  });

  it("shows each product's cover on its card", () => {
    const { container } = render(<PurchaseLibrary purchases={[purchase({ id: "course", kind: "course", href: "/learn/course", coverUrl: "https://cdn/cover.png" }), purchase()]} />);
    const covers = container.querySelectorAll("article img");
    expect(covers).toHaveLength(1);
    expect(covers[0]).toHaveAttribute("src", "https://cdn/cover.png");
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

it("offers a course's PDF beside the classroom only while the course is open", () => {
  render(<PurchaseLibrary purchases={[
    purchase({ id: "open", name: "Open course", kind: "course", href: "/learn/open", pdfHref: "/learn/open/pdf" }),
    purchase({ id: "gone", name: "Expired course", kind: "course", status: "expired", href: null, pdfHref: null }),
  ]} />);
  expect(screen.getByRole("link", { name: "เปิด PDF ประกอบคอร์ส" })).toHaveAttribute("href", "/learn/open/pdf")
  expect(screen.getByRole("link", { name: "เปิด PDF ประกอบคอร์ส" })).toHaveAttribute("target", "_blank");
  expect(screen.getAllByRole("link", { name: /PDF/ })).toHaveLength(1);
});

describe("products from the seller's own shop", () => {
  it("opens each product the way a buyer would, without mixing it into purchases", () => {
    render(<PurchaseLibrary purchases={[]} tryouts={[
      { id: "c", name: "My course", kind: "course", published: true, coverUrl: "/cover.webp", href: "/learn/c", pdfHref: "/learn/c/pdf", progress: { answered: 3, total: 10 } },
      { id: "f", name: "My file", kind: "file", published: false, coverUrl: null, href: "/api/products/f/file" },
      { id: "e", name: "Empty file", kind: "file", published: true, coverUrl: null, href: null },
      { id: "k", name: "My key", kind: "key", published: true, coverUrl: null, href: "/dashboard/products/k/edit" },
    ]} />);
    const section = screen.getByRole("region", { name: "จากร้านค้าของฉัน" });
    expect(within(section).getByRole("link", { name: "เข้าเรียน" })).toHaveAttribute("href", "/learn/c");
    expect(within(section).getByRole("link", { name: "เปิดไฟล์" })).toHaveAttribute("href", "/api/products/f/file");
    expect(within(section).getByRole("link", { name: "จัดการคีย์" })).toHaveAttribute("href", "/dashboard/products/k/edit");
    expect(within(section).getByText("ยังไม่ได้อัปโหลดไฟล์ของสินค้านี้")).toBeInTheDocument();
    expect(within(section).getByText("ยังไม่เผยแพร่")).toBeInTheDocument();
    expect(within(section).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
    expect(screen.getByText("ยังไม่มีรายการที่สั่งซื้อ")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "เปิด PDF ประกอบคอร์ส" })).toHaveAttribute("href", "/learn/c/pdf");
    expect(within(section).getAllByRole("link", { name: /PDF/ })).toHaveLength(1);
    expect(section.querySelectorAll("img")).toHaveLength(1);
    expect(section.querySelector("img")).toHaveAttribute("src", "/cover.webp");
  });
  it("is absent for buyers without a shop", () => {
    render(<PurchaseLibrary purchases={[]} />);
    expect(screen.queryByText("จากร้านค้าของฉัน")).not.toBeInTheDocument();
  });
});
