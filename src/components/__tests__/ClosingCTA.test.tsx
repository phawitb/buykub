import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClosingCTA } from "@/components/ClosingCTA";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("ClosingCTA", () => {
  it("normalizes the desired store slug and carries it into onboarding", async () => {
    const user = userEvent.setup();
    render(<ClosingCTA ctaHref="/login" />);

    await user.type(screen.getByRole("textbox", { name: "ชื่อร้านของคุณ" }), "My Shop!");
    await user.click(screen.getByRole("button", { name: "เปิดร้านเลย" }));

    expect(push).toHaveBeenCalledWith(
      "/login?next=%2Fdashboard%2Fsettings%3Fslug%3Dmy-shop",
    );
  });

  it("draws one focus ring around the complete shop URL and submit field", () => {
    render(<ClosingCTA />);

    const input = screen.getByRole("textbox", { name: "ชื่อร้านของคุณ" });
    expect(input).toHaveAttribute("data-composite-input");
    expect(input).toHaveClass("focus-visible:outline-none");
    expect(input.closest("form")).toHaveClass(
      "focus-within:ring-2",
      "focus-within:ring-accent/20",
    );
    expect(input.previousElementSibling).toHaveTextContent("buykub.com/");
  });
});
