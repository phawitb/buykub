import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MetaPixel, META_PIXEL_ID } from "../MetaPixel";

const nav = vi.hoisted(() => ({ pathname: "/dashboard/products", search: "create=1" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("next/script", () => ({ default: ({ id, children }: { id: string; children: string }) => <script data-testid={id}>{children}</script> }));

beforeEach(() => { nav.pathname = "/dashboard/products"; nav.search = "create=1"; });

describe("MetaPixel", () => {
  it("loads on the open-a-shop page", () => {
    const { getByTestId } = render(<MetaPixel />);
    expect(getByTestId("meta-pixel").textContent).toContain(`fbq('init','${META_PIXEL_ID}')`);
  });
  it("stays off the products list without create=1", () => {
    nav.search = "";
    expect(render(<MetaPixel />).container.innerHTML).toBe("");
  });
  it("stays off other pages that carry create=1", () => {
    nav.pathname = "/dashboard/products/new";
    expect(render(<MetaPixel />).container.innerHTML).toBe("");
  });
});
