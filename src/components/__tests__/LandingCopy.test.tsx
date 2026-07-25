import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAQ } from "@/components/FAQ";
import { Features } from "@/components/Features";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Pricing } from "@/components/Pricing";

describe("landing page copy", () => {
  it("describes the current sign-in choices and Monday payout schedule consistently", () => {
    render(
      <>
        <Hero />
        <HowItWorks />
        <Features />
        <Pricing />
        <FAQ />
      </>,
    );

    expect(
      screen.getByText(/สมัครฟรีด้วยอีเมลหรือ Google/),
    ).toBeInTheDocument();
    expect(screen.getByText("฿330K+")).toBeInTheDocument();
    expect(screen.getAllByText(/ทุกวันจันทร์/).length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText("ทุกสัปดาห์")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "ทุกอย่างที่คุณต้องการ" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "ครบจบในที่เดียว ไม่ต้องสลับหลายเครื่องมือ ตั้งแต่สร้างร้านจนถึงรับเงิน",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "เลือกแพลนที่ใช่" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ค่าธรรมเนียม 5% ต่อออเดอร์")).toBeInTheDocument();
    expect(screen.getByText("สินค้าไม่จำกัด")).toBeInTheDocument();
    expect(screen.getByText("จองไม่จำกัด")).toBeInTheDocument();
    expect(screen.getByText("ไม่มีลายน้ำ")).toBeInTheDocument();
    expect(
      screen.getAllByText("โอนเงินทุกวันจันทร์").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByRole("link", { name: "เริ่มเปิดร้านฟรี" }),
    ).toHaveAttribute("href", "/login?next=%2Fdashboard");
    expect(screen.queryByText("FREE")).not.toBeInTheDocument();
    expect(screen.queryByText("PRO")).not.toBeInTheDocument();
    expect(screen.queryByText("PRO+")).not.toBeInTheDocument();
    expect(screen.queryByText(/8%|2%|0%/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "คำถามที่เจอบ่อย" }),
    ).toBeInTheDocument();
  });
});
