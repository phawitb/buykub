import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAQ } from "@/components/FAQ";
import { Hero } from "@/components/Hero";
import { Pricing } from "@/components/Pricing";
import { PaymentLinkBand } from "@/components/PaymentLinkBand";
import { SellableGrid } from "@/components/SellableGrid";
import { StepsBand } from "@/components/StepsBand";
import { Testimonials } from "@/components/Testimonials";

/** Mirrors the real composition of `/`. These assertions are the guard against
 *  untrue copy returning — keep them in step with the page. */
function renderLanding() {
  return render(
    <>
      <Hero />
      <SellableGrid ctaHref="/x" />
      <StepsBand />
      <PaymentLinkBand />
      <Testimonials />
      <Pricing />
      <FAQ />
    </>,
  );
}

describe("landing page copy", () => {
  it("states the published fee and the real payout process", () => {
    renderLanding();

    expect(screen.getAllByText(/ค่าธรรมเนียม.{0,2}5% ต่อออเดอร์/).length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByRole("heading", { name: "เริ่มต้นได้ทันทีไม่มีค่าใช้จ่าย" }),
    ).toBeInTheDocument();
    expect(screen.getByText("สินค้าไม่จำกัด")).toBeInTheDocument();
    expect(screen.getByText("ไม่มีลายน้ำ")).toBeInTheDocument();
    expect(screen.getByText("โอนเข้าบัญชีพร้อมสลิปยืนยัน")).toBeInTheDocument();
    expect(screen.getByText("คอร์สออนไลน์")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เริ่มเปิดร้านฟรี" })).toHaveAttribute(
      "href",
      "/login?next=%2Fdashboard%2Fproducts%3Fcreate%3D1",
    );
    expect(screen.getByRole("heading", { name: "คำถามที่เจอบ่อย" })).toBeInTheDocument();
    expect(screen.queryByText("FREE")).not.toBeInTheDocument();
    expect(screen.queryByText(/8%|2%|0%/)).not.toBeInTheDocument();
  });

  it("promises no payout schedule the platform does not keep", () => {
    const { container } = renderLanding();
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/ทุกวันจันทร์|ทุกสัปดาห์|โอนอัตโนมัติ(?!.{0,8}ยังไม่)/);
    expect(text).toMatch(/ระยะถือครอง 7 วัน/);
    expect(text).toMatch(/ทีมงาน(เป็นผู้โอน|จะโอน|โอน)/);
  });

  it("carries no testimonial, shop count or revenue total", () => {
    const { container } = renderLanding();
    const text = container.textContent ?? "";

    // There is no customer to quote: the catalog was reset on 2026-11-13 and no
    // paid live order has settled. The testimonial section ships with
    // placeholder copy, and it must say so on the page — if someone drops the
    // label without supplying real, permissioned quotes, this fails.
    expect(
      screen.getByText(/ข้อความตัวอย่างสำหรับจัดหน้า · ยังไม่ใช่รีวิวจากผู้ขายจริง/),
    ).toBeInTheDocument();
    // The row renders the list twice so the loop has no seam. The duplicate
    // lane is aria-hidden, so browsers announce each review once even though
    // getAllByLabelText — which does not filter on aria-hidden — sees both.
    const lanes = container.querySelectorAll(".marquee-track > ul");
    expect(lanes).toHaveLength(2);
    expect(lanes[1]).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByLabelText(/ให้คะแนน \d จาก 5 ดาว/)).toHaveLength(40);
    expect(text).not.toMatch(/รีวิวจาก\s*\d|ลูกค้ากว่า|ผู้ใช้กว่า|ผู้ขายกว่า/);
    expect(text).not.toMatch(/\d+\s*\+\s*ร้าน|ร้านที่เปิดใช้งานแล้ว/);
    expect(text).not.toMatch(/฿\s?\d+(\.\d+)?[KMม]|ยอดขายรวม/);
    expect(
      screen.getByRole("link", { name: /เปิดร้านตัวอย่างที่ซื้อได้จริง/ }),
    ).toHaveAttribute("href", "/buykub-store");
  });

  it("gives every landing photograph a Thai alt description", () => {
    const { container } = renderLanding();
    const images = [...container.querySelectorAll("img")];

    expect(images.length).toBeGreaterThanOrEqual(6);
    for (const image of images) {
      expect(image.getAttribute("alt")).toMatch(/[฀-๿]/);
    }
  });
});
