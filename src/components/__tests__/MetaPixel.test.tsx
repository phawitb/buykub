import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { MetaPixel, META_PIXEL_ID } from "../MetaPixel";

const nav = vi.hoisted(() => ({ pathname: "/", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("next/script", () => ({ default: ({ id, children }: { id: string; children: string }) => <script data-testid={id}>{children}</script> }));

const fbq = vi.fn();
beforeEach(() => { nav.pathname = "/"; nav.search = ""; fbq.mockReset(); (window as unknown as { fbq: typeof fbq }).fbq = fbq; });
afterEach(() => { delete (window as unknown as { fbq?: typeof fbq }).fbq; });

describe("MetaPixel", () => {
  it("loads the base code with the pixel id", () => {
    const { getByTestId } = render(<MetaPixel />);
    expect(getByTestId("meta-pixel").textContent).toContain(`fbq('init','${META_PIXEL_ID}')`);
  });
  it("leaves the first page view to the base code", () => {
    render(<MetaPixel />);
    expect(fbq).not.toHaveBeenCalled();
  });
  it("counts a page view on each route change", () => {
    const view = render(<MetaPixel />);
    nav.pathname = "/mysheet";
    view.rerender(<MetaPixel />);
    nav.search = "create=1";
    view.rerender(<MetaPixel />);
    expect(fbq).toHaveBeenCalledTimes(2);
    expect(fbq).toHaveBeenCalledWith("track", "PageView");
  });
});
