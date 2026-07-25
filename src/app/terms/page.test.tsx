import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TermsPage from "./page";

describe("TermsPage", () => {
  it("does not describe a removed subscription system", () => {
    render(<TermsPage />);

    expect(screen.queryByText(/ค่าสมาชิก/)).not.toBeInTheDocument();
    expect(screen.getByText(/ค่าธรรมเนียม 5% ต่อออเดอร์/)).toBeInTheDocument();
  });
});
