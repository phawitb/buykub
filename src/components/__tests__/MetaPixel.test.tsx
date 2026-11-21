import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MetaPixel, META_PIXEL_ID } from "../MetaPixel";

vi.mock("next/script", () => ({ default: ({ id, children }: { id: string; children: string }) => <script data-testid={id}>{children}</script> }));

describe("MetaPixel", () => {
  it("loads the base code with the pixel id and one PageView", () => {
    const { getByTestId } = render(<MetaPixel />);
    const code = getByTestId("meta-pixel").textContent ?? "";
    expect(code).toContain(`fbq('init','${META_PIXEL_ID}')`);
    expect(code.match(/fbq\('track','PageView'\)/g)).toHaveLength(1);
  });
});
