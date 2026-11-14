import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  it("renders the accessible BUYKUB wordmark in two solid tones", () => {
    render(<BrandLogo className="text-lg" />);

    const logo = screen.getByLabelText("BUYKUB");
    expect(logo).toHaveTextContent("BUYKUB");
    expect(logo).toHaveClass("text-lg");
    expect(screen.getByText("BUY")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("KUB")).toHaveClass("text-accent-text");
    // Gradient text is banned; the mark must not reintroduce it.
    expect(screen.getByText("KUB").className).not.toMatch(/bg-gradient|bg-clip-text/);
  });
});
