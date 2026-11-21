import { describe, expect, it } from "vitest";
import {
  PAGE_MARGIN_RATIO,
  pageBox,
  pageEdgeMetrics,
  squareSide,
} from "@/features/products/pdf/frame";

describe("squareSide", () => {
  it("matts a page into a square as big as its longer edge", () => {
    expect(squareSide(849, 1200)).toBe(1200);
    expect(squareSide(1200, 675)).toBe(1200);
    expect(squareSide(1000, 1000)).toBe(1000);
  });
});

describe("pageBox", () => {
  it("shrinks a portrait page until its height fits, and centres it", () => {
    const box = pageBox(850, 1200, 1200);

    // The height is what runs out of room first, so it takes the inner square.
    expect(box).toEqual({ x: 226, y: 72, width: 748, height: 1056 });
    // Its proportions survive the shrink.
    expect(box.width / box.height).toBeCloseTo(850 / 1200, 3);
  });

  it("shrinks a landscape page by its width instead", () => {
    const box = pageBox(1200, 800, 1200);

    expect(box).toEqual({ x: 72, y: 248, width: 1056, height: 704 });
  });

  it("leaves the mat showing on all four sides of a square page", () => {
    const box = pageBox(1000, 1000, 1000);

    expect(box).toEqual({ x: 60, y: 60, width: 880, height: 880 });
    expect(box.x).toBe(Math.round(1000 * PAGE_MARGIN_RATIO));
  });

  it("keeps every page inside the square, whatever shape it is", () => {
    for (const [width, height] of [
      [612, 792],
      [1684, 1190],
      [1, 2000],
      [2000, 1],
    ]) {
      const box = pageBox(width, height, 1200);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1200);
      expect(box.y + box.height).toBeLessThanOrEqual(1200);
    }
  });

  it("leaves the shadow room to fall inside the square", () => {
    const side = 1200;
    const box = pageBox(850, 1200, side);
    const edge = pageEdgeMetrics(side);

    // The sheet's shadow reaches further than the sheet; the margin has to
    // hold it, or the page looks cropped again along the bottom.
    expect(box.y + box.height + edge.offsetY + edge.blur).toBeLessThanOrEqual(side);
  });

  it("has nothing to place for an empty page", () => {
    expect(pageBox(0, 0, 1200)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(pageBox(850, 1200, 0)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe("pageEdgeMetrics", () => {
  it("scales the sheet's edge with the square it is drawn in", () => {
    expect(pageEdgeMetrics(1200)).toEqual({ line: 2, blur: 22, offsetY: 7 });
  });

  it("keeps a visible edge even on a tiny square", () => {
    const edge = pageEdgeMetrics(40);
    expect(edge.line).toBeGreaterThanOrEqual(1);
    expect(edge.blur).toBeGreaterThanOrEqual(1);
    expect(edge.offsetY).toBeGreaterThanOrEqual(1);
  });
});
