import { MAX_PRODUCT_IMAGES } from "@/features/products/validation";

/** Only the first pages are read; a long PDF costs the same as a short one. */
export const MAX_PDF_TEXT_PAGES = 10;
/** Preview images share the five product image slots. */
export const MAX_PDF_PREVIEW_PAGES = MAX_PRODUCT_IMAGES;
/** Characters kept per page before the draft request leaves the browser. */
export const MAX_PDF_PAGE_CHARS = 4000;

export type PdfPreviewPreferences = {
  previewPageCount: number;
  watermarkEnabled: boolean;
  watermarkText: string;
  blurStrength: number;
  watermarkOpacity: number;
};

export const DEFAULT_PDF_PREVIEW_PREFERENCES: PdfPreviewPreferences = {
  previewPageCount: 3,
  watermarkEnabled: true,
  watermarkText: "",
  blurStrength: 6,
  watermarkOpacity: 35,
};

export const PDF_PREVIEW_LIMITS = {
  previewPageCount: { min: 1, max: MAX_PDF_PREVIEW_PAGES },
  blurStrength: { min: 0, max: 20 },
  watermarkOpacity: { min: 5, max: 100 },
  watermarkText: { max: 40 },
} as const;

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Accepts a database row, a form value or a half-filled object. */
export function normalizePdfPreviewPreferences(raw: unknown): PdfPreviewPreferences {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const read = (camel: string, snake: string) =>
    source[camel] !== undefined ? source[camel] : source[snake];
  const text = read("watermarkText", "watermark_text");
  const enabled = read("watermarkEnabled", "watermark_enabled");

  return {
    previewPageCount: clampInteger(
      read("previewPageCount", "preview_page_count"),
      PDF_PREVIEW_LIMITS.previewPageCount.min,
      PDF_PREVIEW_LIMITS.previewPageCount.max,
      DEFAULT_PDF_PREVIEW_PREFERENCES.previewPageCount,
    ),
    watermarkEnabled:
      typeof enabled === "boolean" ? enabled : DEFAULT_PDF_PREVIEW_PREFERENCES.watermarkEnabled,
    watermarkText:
      typeof text === "string"
        ? text.replace(/\s+/g, " ").trim().slice(0, PDF_PREVIEW_LIMITS.watermarkText.max)
        : DEFAULT_PDF_PREVIEW_PREFERENCES.watermarkText,
    blurStrength: clampInteger(
      read("blurStrength", "blur_strength"),
      PDF_PREVIEW_LIMITS.blurStrength.min,
      PDF_PREVIEW_LIMITS.blurStrength.max,
      DEFAULT_PDF_PREVIEW_PREFERENCES.blurStrength,
    ),
    watermarkOpacity: clampInteger(
      read("watermarkOpacity", "watermark_opacity"),
      PDF_PREVIEW_LIMITS.watermarkOpacity.min,
      PDF_PREVIEW_LIMITS.watermarkOpacity.max,
      DEFAULT_PDF_PREVIEW_PREFERENCES.watermarkOpacity,
    ),
  };
}

export type PdfPreviewSlot = {
  pageNumber: number;
  protect: boolean;
};

/**
 * The first page sells the product, so it stays clean. Every later preview page
 * is protected, which is what keeps the sample from being the product itself.
 */
export function pdfPreviewPlan(
  preferences: PdfPreviewPreferences,
  documentPageCount: number,
): PdfPreviewSlot[] {
  const pages = Math.min(
    preferences.previewPageCount,
    Math.max(0, documentPageCount),
    MAX_PDF_PREVIEW_PAGES,
  );
  return Array.from({ length: pages }, (_, index) => ({
    pageNumber: index + 1,
    protect: index > 0 && preferences.watermarkEnabled,
  }));
}

export function watermarkLabel(
  preferences: PdfPreviewPreferences,
  shopName: string | null | undefined,
): string {
  if (preferences.watermarkText) return preferences.watermarkText;
  const fromShop = (shopName ?? "").replace(/\s+/g, " ").trim();
  return (fromShop || "ตัวอย่าง").slice(0, PDF_PREVIEW_LIMITS.watermarkText.max);
}
