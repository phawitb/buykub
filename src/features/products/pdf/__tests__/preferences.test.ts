import { describe, expect, it } from "vitest";
import {
  DEFAULT_PDF_PREVIEW_PREFERENCES,
  isProtected,
  MAX_PDF_PREVIEW_PAGES,
  normalizePdfPreviewPreferences,
  PAGE_BLUR_FALLBACK_STRENGTH,
  pageBlurStrength,
  pdfPreviewPlan,
  watermarkLabel,
} from "@/features/products/pdf/preferences";
import { watermarkTiles } from "@/features/products/pdf/watermark";

describe("normalizePdfPreviewPreferences", () => {
  it("defaults every field when nothing is stored", () => {
    expect(normalizePdfPreviewPreferences(null)).toEqual(DEFAULT_PDF_PREVIEW_PREFERENCES);
    expect(normalizePdfPreviewPreferences({})).toEqual(DEFAULT_PDF_PREVIEW_PREFERENCES);
  });

  it("reads a database row with snake_case columns", () => {
    expect(
      normalizePdfPreviewPreferences({
        preview_page_count: 4,
        watermark_enabled: false,
        watermark_text: "  ตัวอย่าง   เท่านั้น ",
        blur_strength: 12,
        watermark_opacity: 60,
      }),
    ).toEqual({
      previewPageCount: 4,
      watermarkEnabled: false,
      watermarkText: "ตัวอย่าง เท่านั้น",
      blurStrength: 12,
      watermarkOpacity: 60,
    });
  });

  it("clamps values outside the supported range instead of rejecting them", () => {
    const clamped = normalizePdfPreviewPreferences({
      previewPageCount: 99,
      blurStrength: -4,
      watermarkOpacity: 1000,
    });
    expect(clamped.previewPageCount).toBe(MAX_PDF_PREVIEW_PAGES);
    expect(clamped.blurStrength).toBe(0);
    expect(clamped.watermarkOpacity).toBe(100);
  });

  it("falls back to the default when a number cannot be read", () => {
    expect(normalizePdfPreviewPreferences({ blur_strength: "ไม่ใช่ตัวเลข" }).blurStrength).toBe(
      DEFAULT_PDF_PREVIEW_PREFERENCES.blurStrength,
    );
  });

  it("truncates a long watermark instead of storing an oversized value", () => {
    expect(normalizePdfPreviewPreferences({ watermarkText: "ก".repeat(80) }).watermarkText).toHaveLength(40);
  });
});

describe("pdfPreviewPlan", () => {
  it("marks the pages after the cover without blurring them by default", () => {
    // The seller wants a buyer to be able to read the sample pages. Only the
    // watermark stands between a sample and the product.
    expect(pdfPreviewPlan(DEFAULT_PDF_PREVIEW_PREFERENCES, 10)).toEqual([
      { pageNumber: 1, protection: { blur: false, watermark: false } },
      { pageNumber: 2, protection: { blur: false, watermark: true } },
      { pageNumber: 3, protection: { blur: false, watermark: true } },
      { pageNumber: 4, protection: { blur: false, watermark: true } },
      { pageNumber: 5, protection: { blur: false, watermark: true } },
    ]);
  });

  it("blurs the later pages once the seller asks for it", () => {
    const plan = pdfPreviewPlan({ ...DEFAULT_PDF_PREVIEW_PREFERENCES, blurStrength: 6 }, 10);
    expect(plan[0].protection).toEqual({ blur: false, watermark: false });
    expect(plan[1].protection).toEqual({ blur: true, watermark: true });
  });

  it("never plans more pages than the document has", () => {
    expect(pdfPreviewPlan(DEFAULT_PDF_PREVIEW_PREFERENCES, 2)).toEqual([
      { pageNumber: 1, protection: { blur: false, watermark: false } },
      { pageNumber: 2, protection: { blur: false, watermark: true } },
    ]);
    expect(pdfPreviewPlan(DEFAULT_PDF_PREVIEW_PREFERENCES, 0)).toEqual([]);
  });

  it("leaves every page unprotected when the seller turns the watermark off", () => {
    const plan = pdfPreviewPlan(
      { ...DEFAULT_PDF_PREVIEW_PREFERENCES, watermarkEnabled: false, blurStrength: 10 },
      5,
    );
    expect(plan.every((slot) => !isProtected(slot.protection))).toBe(true);
  });

  it("caps the plan at the product image slots", () => {
    expect(
      pdfPreviewPlan({ ...DEFAULT_PDF_PREVIEW_PREFERENCES, previewPageCount: 99 }, 50),
    ).toHaveLength(MAX_PDF_PREVIEW_PAGES);
  });
});

describe("watermarkLabel", () => {
  it("prefers the seller's own text", () => {
    expect(
      watermarkLabel({ ...DEFAULT_PDF_PREVIEW_PREFERENCES, watermarkText: "ห้ามคัดลอก" }, "ร้านเอ"),
    ).toBe("ห้ามคัดลอก");
  });

  it("falls back to the shop name, then to a generic label", () => {
    expect(watermarkLabel(DEFAULT_PDF_PREVIEW_PREFERENCES, "  ร้าน  เอ ")).toBe("ร้าน เอ");
    expect(watermarkLabel(DEFAULT_PDF_PREVIEW_PREFERENCES, null)).toBe("ตัวอย่าง");
    expect(watermarkLabel(DEFAULT_PDF_PREVIEW_PREFERENCES, "   ")).toBe("ตัวอย่าง");
  });
});

describe("watermarkTiles", () => {
  it("covers every corner of a rotated page", () => {
    const tiles = watermarkTiles(800, 1000, 200, 120);
    const reach = Math.hypot(800, 1000) / 2;
    expect(tiles.length).toBeGreaterThan(0);
    expect(Math.max(...tiles.map((tile) => tile.x))).toBeGreaterThanOrEqual(reach - 200);
    expect(Math.min(...tiles.map((tile) => tile.y))).toBeLessThanOrEqual(-reach + 120);
  });

  it("returns nothing for a degenerate page or step", () => {
    expect(watermarkTiles(0, 100, 10, 10)).toEqual([]);
    expect(watermarkTiles(100, 100, 0, 10)).toEqual([]);
  });

  it("staggers alternating rows so the marks do not form a grid", () => {
    const tiles = watermarkTiles(400, 400, 100, 100);
    const rows = new Map<number, number[]>();
    for (const tile of tiles) rows.set(tile.y, [...(rows.get(tile.y) ?? []), tile.x]);
    expect(new Set([...rows.values()].map((row) => row[0] % 100)).size).toBe(2);
  });
});

describe("pageBlurStrength", () => {
  it("keeps the shop's own strength when the seller set one", () => {
    expect(pageBlurStrength(14)).toBe(14);
  });

  it("blurs a single page visibly even when the shop slider sits at zero", () => {
    expect(pageBlurStrength(DEFAULT_PDF_PREVIEW_PREFERENCES.blurStrength)).toBe(
      PAGE_BLUR_FALLBACK_STRENGTH,
    );
    expect(PAGE_BLUR_FALLBACK_STRENGTH).toBeGreaterThan(0);
  });
});
