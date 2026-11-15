import { describe, expect, it } from "vitest";
import {
  MAX_OCR_PAGES,
  OCR_DPI,
  OCR_TRIGGER_CHARS,
  isReadableLine,
  needsOcr,
  normalizeThaiText,
  ocrPagePlan,
  ocrRenderScale,
} from "@/features/products/pdf/ocr";

describe("normalizeThaiText", () => {
  it("puts sara am back together", () => {
    // The recognizer spells ำ as NIKHAHIT + SARA AA, which reads as a different word.
    expect(normalizeThaiText("จํานวน 86 หน้า")).toBe("จำนวน 86 หน้า");
    expect(normalizeThaiText("สําหรับ")).toBe("สำหรับ");
  });

  it("keeps a tone mark that sits inside sara am", () => {
    expect(normalizeThaiText("นํ้า")).toBe("น้ำ");
  });

  it("drops the speckle the recognizer reads off page ruling", () => {
    const raw = ["คู่มือสูตรขนมปัง", "1 |          1 |", "ราคา 390 บาท", "· ~ -", "86 หน้า"].join(
      "\n",
    );
    expect(normalizeThaiText(raw)).toBe("คู่มือสูตรขนมปัง\nราคา 390 บาท\n86 หน้า");
  });

  it("keeps a line that is only a number, because a price can stand alone", () => {
    expect(normalizeThaiText("390")).toBe("390");
  });

  it("collapses runs of spaces and blank lines", () => {
    expect(normalizeThaiText("  ราคา    390  \n\n\n\nบาท  ")).toBe("ราคา 390\nบาท");
  });

  it("survives an empty read", () => {
    expect(normalizeThaiText("")).toBe("");
    expect(normalizeThaiText("\n\n   \n")).toBe("");
  });
});

describe("isReadableLine", () => {
  it("accepts anything with Thai in it", () => {
    expect(isReadableLine("ก")).toBe(true);
    expect(isReadableLine("| ก |")).toBe(true);
  });

  it("accepts two or more adjacent digits or letters", () => {
    expect(isReadableLine("PDF")).toBe(true);
    expect(isReadableLine("25")).toBe(true);
  });

  it("rejects isolated marks and single characters", () => {
    expect(isReadableLine("")).toBe(false);
    expect(isReadableLine("1 | 1 |")).toBe(false);
    expect(isReadableLine("· ~ -")).toBe(false);
    expect(isReadableLine("a")).toBe(false);
  });
});

describe("needsOcr", () => {
  it("asks for OCR when the text layer is empty", () => {
    expect(needsOcr([])).toBe(true);
  });

  it("asks for OCR when the text layer holds only a scrap", () => {
    // A scanned file often still yields a few characters of header junk.
    expect(needsOcr([{ text: "หน้า 1" }])).toBe(true);
  });

  it("leaves a real text layer alone", () => {
    const page = { text: "ก".repeat(OCR_TRIGGER_CHARS) };
    expect(needsOcr([page])).toBe(false);
  });

  it("counts every page together, not each on its own", () => {
    const pages = Array.from({ length: 4 }, () => ({ text: "ก".repeat(60) }));
    expect(needsOcr(pages)).toBe(false);
  });

  it("ignores whitespace when measuring", () => {
    expect(needsOcr([{ text: " \n".repeat(400) }])).toBe(true);
  });
});

describe("ocrPagePlan", () => {
  it("reads only the opening pages, because each one costs seconds", () => {
    expect(ocrPagePlan(40)).toEqual([1, 2, 3]);
    expect(ocrPagePlan(40)).toHaveLength(MAX_OCR_PAGES);
  });

  it("never asks for a page the document does not have", () => {
    expect(ocrPagePlan(2)).toEqual([1, 2]);
    expect(ocrPagePlan(0)).toEqual([]);
    expect(ocrPagePlan(-3)).toEqual([]);
  });
});

describe("ocrRenderScale", () => {
  const A4_WIDTH = 595;
  const A4_HEIGHT = 842;
  // Mirrors the canvas ceilings in the module under test.
  const MAX_EDGE = 4096;
  const MAX_PIXELS = 12_000_000;

  it("renders at the resolution the recognizer reads best", () => {
    expect(ocrRenderScale(A4_WIDTH, A4_HEIGHT)).toBeCloseTo(OCR_DPI / 72, 5);
  });

  it("keeps an A4 page inside what a mobile browser will allocate", () => {
    const scale = ocrRenderScale(A4_WIDTH, A4_HEIGHT);
    expect(A4_WIDTH * scale).toBeLessThanOrEqual(MAX_EDGE);
    expect(A4_HEIGHT * scale).toBeLessThanOrEqual(MAX_EDGE);
    expect(A4_WIDTH * scale * A4_HEIGHT * scale).toBeLessThanOrEqual(MAX_PIXELS);
  });

  it("shrinks a poster-sized page rather than failing to allocate it", () => {
    const scale = ocrRenderScale(2400, 3400);
    expect(scale).toBeLessThan(OCR_DPI / 72);
    expect(2400 * scale).toBeLessThanOrEqual(MAX_EDGE);
    expect(2400 * scale * 3400 * scale).toBeLessThanOrEqual(MAX_PIXELS);
  });

  it("holds the canvas limits even when that means scaling a page down", () => {
    const scale = ocrRenderScale(6000, 9000);
    expect(scale).toBeLessThan(1);
    expect(9000 * scale).toBeLessThanOrEqual(MAX_EDGE);
    expect(6000 * scale * 9000 * scale).toBeLessThanOrEqual(MAX_PIXELS);
  });

  it("falls back to the target when a page reports no size", () => {
    expect(ocrRenderScale(0, 0)).toBeCloseTo(OCR_DPI / 72, 5);
  });
});
