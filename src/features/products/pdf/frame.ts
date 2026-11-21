"use client";

/**
 * A product image is shown in a square, in the form and on the storefront
 * alike. A PDF page is not square, so a page dropped into that square loses
 * its head and its feet to the crop — on a sample page, the part the buyer
 * most wants to judge. Each page is shrunk to fit a square of its own instead,
 * centred on a soft blue mat that is the same on every page, so a set of
 * previews reads as one series of sheets rather than five different crops.
 *
 * The page is given an edge of its own — a hairline and a soft shadow — so it
 * reads as a sheet lying on the mat whatever it is printed on. Without one, a
 * cover whose own artwork is pale blue runs straight into the mat and comes
 * back looking full-bleed, while the white pages beside it sit in a frame.
 */

/** The mat every page sits on: a deeper step of the app's own `--accent-soft`. */
export const PAGE_GROUND_COLOR = "#dce9f8";

/** The hairline around the page, a shade deeper than the mat. */
export const PAGE_EDGE_COLOR = "#b4cfe8";

/** The shadow the sheet casts on the mat. */
export const PAGE_SHADOW_COLOR = "rgba(23, 54, 93, 0.22)";

/** How much of the square is mat, on each side of the page. */
export const PAGE_MARGIN_RATIO = 0.06;

/**
 * The hairline and the shadow in pixels, scaled to the square they are drawn
 * in, so a page keeps the same edge whatever size the preview is rendered at.
 */
export function pageEdgeMetrics(side: number) {
  return {
    line: Math.max(1, Math.round(side * 0.0015)),
    blur: Math.max(1, Math.round(side * 0.018)),
    offsetY: Math.max(1, Math.round(side * 0.006)),
  };
}

export type PageBox = { x: number; y: number; width: number; height: number };

/**
 * Where a page of this size goes inside a square of this side: scaled down by
 * whichever edge runs out of room first, so the whole page shows and its
 * proportions are kept, then centred with the mat showing all the way round.
 */
export function pageBox(
  width: number,
  height: number,
  side: number,
  margin = PAGE_MARGIN_RATIO,
): PageBox {
  if (width <= 0 || height <= 0 || side <= 0) return { x: 0, y: 0, width: 0, height: 0 };

  const inner = Math.max(1, side - 2 * Math.round(side * margin));
  const scale = Math.min(inner / width, inner / height);
  const drawn = {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
  return {
    x: Math.round((side - drawn.width) / 2),
    y: Math.round((side - drawn.height) / 2),
    ...drawn,
  };
}

/** The side of the square a rendered page is matted into. */
export function squareSide(width: number, height: number): number {
  return Math.max(width, height);
}

/** Lays a rendered page on the blue mat, shrunk to fit and centred. */
export function fitPageToSquare(page: HTMLCanvasElement): HTMLCanvasElement {
  const side = squareSide(page.width, page.height);
  if (side <= 0) return page;

  const canvas = window.document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext("2d");
  if (!context) return page;

  context.fillStyle = PAGE_GROUND_COLOR;
  context.fillRect(0, 0, side, side);

  const box = pageBox(page.width, page.height, side);
  const edge = pageEdgeMetrics(side);

  // A filled rectangle first, only so the sheet casts its shadow; the page is
  // drawn over it, and a page with transparency keeps paper behind it.
  context.save();
  context.shadowColor = PAGE_SHADOW_COLOR;
  context.shadowBlur = edge.blur;
  context.shadowOffsetY = edge.offsetY;
  context.fillStyle = "#ffffff";
  context.fillRect(box.x, box.y, box.width, box.height);
  context.restore();

  context.drawImage(page, box.x, box.y, box.width, box.height);

  context.strokeStyle = PAGE_EDGE_COLOR;
  context.lineWidth = edge.line;
  context.strokeRect(
    box.x + edge.line / 2,
    box.y + edge.line / 2,
    box.width - edge.line,
    box.height - edge.line,
  );
  return canvas;
}
