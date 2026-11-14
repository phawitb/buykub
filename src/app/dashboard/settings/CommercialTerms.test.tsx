import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommercialTerms } from "./CommercialTerms";

describe("CommercialTerms", () => {
  it("shows the same universal terms for every shop", () => {
    render(<CommercialTerms />);

    expect(screen.getByText("ค่าธรรมเนียม 5% ต่อออเดอร์")).toBeInTheDocument();
    expect(screen.getByText("ไฟล์และคอร์สเรียนไม่จำกัด")).toBeInTheDocument();
    expect(screen.getByText("ไม่มีลายน้ำ")).toBeInTheDocument();
    expect(screen.getByText("โอนเข้าบัญชีพร้อมสลิปยืนยัน")).toBeInTheDocument();
    expect(screen.queryByText(/ทุกวันจันทร์/)).not.toBeInTheDocument();
    expect(screen.getByText(/ยังไม่มีระบบโอนอัตโนมัติ/)).toBeInTheDocument();
    expect(screen.queryByText(/Free|Pro|อัปเกรด/)).not.toBeInTheDocument();
  });
});
