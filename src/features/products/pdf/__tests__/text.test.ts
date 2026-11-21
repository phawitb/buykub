import { describe, expect, it } from "vitest";
import { joinTextItems, recomposeThai, separatedByGap, startsNewLine } from "@/features/products/pdf/text";

/** One positioned fragment, shaped the way pdf.js reports them. */
function fragment(options: {
  str: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  hasEOL?: boolean;
}) {
  return {
    str: options.str,
    width: options.width ?? options.str.length * 5,
    height: options.height ?? 10,
    transform: [10, 0, 0, 10, options.x, options.y],
    hasEOL: options.hasEOL ?? false,
  };
}

describe("joinTextItems", () => {
  it("keeps a Thai word whole across the fragments its marks split it into", () => {
    // Chromium's exporter repositions for every combining mark, so หนังสือ
    // arrives in pieces that sit flush against each other.
    const items = [
      fragment({ str: "ห", x: 0, y: 100, width: 6 }),
      fragment({ str: "นั", x: 6, y: 100, width: 7 }),
      fragment({ str: "งสื", x: 13, y: 100, width: 12 }),
      fragment({ str: "อ", x: 25, y: 100, width: 6 }),
    ];
    expect(joinTextItems(items)).toBe("หนังสือ");
  });

  it("spaces fragments that visible space separates", () => {
    const items = [
      fragment({ str: "Suomen", x: 0, y: 100, width: 30 }),
      fragment({ str: "mestari", x: 36, y: 100, width: 30 }),
    ];
    expect(joinTextItems(items)).toBe("Suomen mestari");
  });

  it("breaks the line when the baseline drops to the next one", () => {
    const items = [
      fragment({ str: "ราคา 390 บาท", x: 0, y: 120, width: 50 }),
      fragment({ str: "86 หน้า", x: 0, y: 100, width: 30 }),
    ];
    expect(joinTextItems(items)).toBe("ราคา 390 บาท\n86 หน้า");
  });

  it("keeps an arched heading on one line", () => {
    // Each fragment of an arched run sits a little lower than the last, far
    // enough to look like a new line, while still running flush along one.
    const items = [
      fragment({ str: "สรุปเรียงบทตามห", x: 0, y: 100, width: 60 }),
      fragment({ str: "นังสือเรียน", x: 60, y: 92, width: 44 }),
    ];
    expect(joinTextItems(items)).toBe("สรุปเรียงบทตามหนังสือเรียน");
  });

  it("breaks the line where the exporter marks the end of one", () => {
    const items = [
      fragment({ str: "Note สรุป", x: 0, y: 100, width: 40, hasEOL: true }),
      fragment({ str: "เบื้องต้น", x: 0, y: 100, width: 30 }),
    ];
    expect(joinTextItems(items)).toBe("Note สรุป\nเบื้องต้น");
  });

  it("drops the placeholder left where a glyph had no name", () => {
    // A subset font with no ToUnicode entry for a tone mark yields U+0000. The
    // mark is gone from the file either way; the NUL must not reach the model.
    const items = [fragment({ str: "โน\u0000ตเล่มนี\u0000", x: 0, y: 100, width: 40 })];
    expect(joinTextItems(items)).toBe("โนตเล่มนี");
  });

  it("ignores anything that is not a fragment", () => {
    const items = [null, { type: "beginMarkedContent" }, fragment({ str: "ok", x: 0, y: 100 })];
    expect(joinTextItems(items)).toBe("ok");
  });

  it("recomposes the Thai the exporter spelled in two halves", () => {
    const items = [fragment({ str: "จํานวน 86 หน้า", x: 0, y: 100 })];
    expect(joinTextItems(items)).toBe("จำนวน 86 หน้า");
  });
});

describe("recomposeThai", () => {
  it("puts sara am back together", () => {
    expect(recomposeThai("สําหรับ")).toBe("สำหรับ");
  });

  it("keeps a tone mark that sits inside sara am", () => {
    expect(recomposeThai("นํ้า")).toBe("น้ำ");
  });
});

describe("startsNewLine", () => {
  const left = { str: "a", width: 20, height: 10, x: 0, y: 100, hasEOL: false };

  it("is false while the baseline barely moves", () => {
    expect(startsNewLine(left, { ...left, x: 0, y: 97 })).toBe(false);
  });

  it("is true when the baseline moves and the run restarts", () => {
    expect(startsNewLine(left, { ...left, x: 0, y: 80 })).toBe(true);
  });
});

describe("separatedByGap", () => {
  const left = { str: "a", width: 20, height: 10, x: 0, y: 100, hasEOL: false };

  it("is false for a fragment that starts where the last one ended", () => {
    expect(separatedByGap(left, { ...left, x: 20 })).toBe(false);
  });

  it("is true once a space's worth of room sits between them", () => {
    expect(separatedByGap(left, { ...left, x: 26 })).toBe(true);
  });
});
