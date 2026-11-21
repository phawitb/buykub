import { describe, expect, it } from "vitest";
import {
  PAGE_FALLBACK_COLOR,
  patchContextStyles,
  readableStyle,
  UNSUPPORTED_SHADING_COLOR,
} from "@/features/products/pdf/shading";

/** A stand-in for a 2D-context prototype: two accessors over stored values. */
function fakePrototype() {
  const store = new WeakMap<object, Record<string, unknown>>();
  const values = (target: object) => {
    const existing = store.get(target);
    if (existing) return existing;
    const created: Record<string, unknown> = {};
    store.set(target, created);
    return created;
  };
  const prototype = {};
  for (const name of ["fillStyle", "strokeStyle"]) {
    Object.defineProperty(prototype, name, {
      configurable: true,
      get(this: object) {
        return values(this)[name];
      },
      set(this: object, value: unknown) {
        values(this)[name] = value;
      },
    });
  }
  return prototype as { fillStyle: unknown; strokeStyle: unknown };
}

describe("readableStyle", () => {
  it("replaces the colour pdf.js paints a shading it cannot read", () => {
    expect(readableStyle(UNSUPPORTED_SHADING_COLOR)).toBe(PAGE_FALLBACK_COLOR);
  });

  it("leaves a colour the page actually asked for alone", () => {
    expect(readableStyle("#ff69b4")).toBe("#ff69b4");
    expect(readableStyle("#0a0a0a")).toBe("#0a0a0a");
  });

  it("passes a gradient or pattern object through untouched", () => {
    const pattern = { kind: "pattern" };
    expect(readableStyle(pattern)).toBe(pattern);
  });
});

describe("patchContextStyles", () => {
  it("catches the fill on every context, not just the one we made", () => {
    const prototype = fakePrototype();
    const undo = patchContextStyles(prototype);
    // A scratch canvas pdf.js made for itself still inherits the substitution.
    const scratch = Object.create(prototype) as { fillStyle: unknown };

    scratch.fillStyle = UNSUPPORTED_SHADING_COLOR;
    expect(scratch.fillStyle).toBe(PAGE_FALLBACK_COLOR);

    scratch.fillStyle = "#1d4ed8";
    expect(scratch.fillStyle).toBe("#1d4ed8");

    undo?.();
    scratch.fillStyle = UNSUPPORTED_SHADING_COLOR;
    expect(scratch.fillStyle).toBe(UNSUPPORTED_SHADING_COLOR);
  });

  it("covers the stroke as well, which a marked-up shading also uses", () => {
    const prototype = fakePrototype();
    patchContextStyles(prototype);
    const context = Object.create(prototype) as { strokeStyle: unknown };

    context.strokeStyle = UNSUPPORTED_SHADING_COLOR;
    expect(context.strokeStyle).toBe(PAGE_FALLBACK_COLOR);
  });

  it("does nothing where there is no such property to patch", () => {
    expect(patchContextStyles({})).toBeNull();
  });
});
