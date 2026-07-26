import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  it("keeps FRAME inherited and renders LINK with the approved gradient", () => {
    render(<BrandLogo className="text-lg" />);

    const logo = screen.getByLabelText("FRAMELINK");
    expect(logo).toHaveTextContent("FRAMELINK");
    expect(logo).toHaveClass("text-lg");
    expect(screen.getByText("LINK")).toHaveClass(
      "bg-gradient-to-r",
      "from-[#006CFC]",
      "via-[#475AFE]",
      "to-[#8938FB]",
      "bg-clip-text",
      "text-transparent",
    );
    expect(screen.getByText("FRAME")).not.toHaveClass("text-muted");
  });
});
