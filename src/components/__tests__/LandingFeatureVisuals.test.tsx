import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";

describe("landing feature demonstrations", () => {
  it("shows a product-like visual demonstration for every step and feature", () => {
    render(
      <>
        <HowItWorks />
        <Features />
      </>,
    );

    expect(
      screen.getAllByRole("img", { name: /ตัวอย่าง/ }),
    ).toHaveLength(7);
  });
});
