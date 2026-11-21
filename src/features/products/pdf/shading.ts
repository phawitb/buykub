"use client";

/**
 * pdf.js draws a few things it cannot read, and says so in colour. A shading
 * it does not implement — a function-based (type 1) gradient, which Canva and
 * InDesign exports use for soft card fills — is painted in flat `hotpink`, so
 * that whoever is looking at the page notices. A seller does not read it that
 * way: they see their cover come back bright pink and conclude our preview is
 * broken. The page is worth more to them with the unreadable fill left as
 * paper, which is what the rest of the sheet is anyway.
 */
export const UNSUPPORTED_SHADING_COLOR = "hotpink";

/** What an unreadable fill is drawn as instead: the colour of a blank page. */
export const PAGE_FALLBACK_COLOR = "#ffffff";

/** The style a page should actually be painted with. */
export function readableStyle<T>(style: T): T | string {
  return style === UNSUPPORTED_SHADING_COLOR ? PAGE_FALLBACK_COLOR : style;
}

type StyleName = "fillStyle" | "strokeStyle";

const STYLE_NAMES: StyleName[] = ["fillStyle", "strokeStyle"];

/**
 * Puts the substitution on one 2D-context prototype and hands back the undo.
 *
 * It has to sit on the prototype rather than on our own canvas: pdf.js paints
 * a shading into a scratch canvas of its own that we never touch.
 */
export function patchContextStyles(prototype: object): (() => void) | null {
  const undo: (() => void)[] = [];

  for (const name of STYLE_NAMES) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    const read = descriptor?.get;
    const write = descriptor?.set;
    if (!descriptor || !read || !write) continue;

    Object.defineProperty(prototype, name, {
      configurable: true,
      enumerable: descriptor.enumerable,
      get(this: unknown) {
        return read.call(this);
      },
      set(this: unknown, style: unknown) {
        write.call(this, readableStyle(style));
      },
    });
    undo.push(() => Object.defineProperty(prototype, name, descriptor));
  }

  if (!undo.length) return null;
  return () => undo.forEach((restore) => restore());
}

function contextPrototypes(): object[] {
  const prototypes: object[] = [];
  if (typeof CanvasRenderingContext2D !== "undefined") {
    prototypes.push(CanvasRenderingContext2D.prototype);
  }
  // pdf.js reaches for an OffscreenCanvas for its scratch work where the
  // browser has one, and that is a different prototype.
  if (typeof OffscreenCanvasRenderingContext2D !== "undefined") {
    prototypes.push(OffscreenCanvasRenderingContext2D.prototype);
  }
  return prototypes;
}

let depth = 0;
let restore: (() => void)[] = [];

/**
 * Runs a page render with unreadable fills drawn as paper. Counted, so a
 * render nested inside another — OCR inside extraction — still leaves the
 * canvas exactly as it found it.
 */
export async function withReadableShadings<T>(run: () => Promise<T>): Promise<T> {
  if (depth === 0) {
    restore = contextPrototypes()
      .map(patchContextStyles)
      .filter((undo): undo is () => void => Boolean(undo));
  }
  depth += 1;
  try {
    return await run();
  } finally {
    depth -= 1;
    if (depth === 0) {
      restore.forEach((undo) => undo());
      restore = [];
    }
  }
}
