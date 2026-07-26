import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  it("renders the accessible BUYKUB split-color wordmark", () => {
    render(<BrandLogo className="text-lg" />);

    const logo = screen.getByLabelText("BUYKUB");
    expect(logo).toHaveTextContent("BUYKUB");
    expect(logo).toHaveClass("text-lg");
    expect(screen.getByText("BUY")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("KUB")).toHaveClass(
      "bg-gradient-to-r",
      "from-[#2563EB]",
      "to-[#7C3AED]",
      "bg-clip-text",
      "text-transparent",
    );
  });
});
