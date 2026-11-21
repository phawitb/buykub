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

/**
 * Five pages, marked but not blurred. A blurred sample proves the pages exist
 * and nothing else; the seller asked for pages a buyer can actually judge,
 * with the shop's name across them so they cannot stand in for the product.
 * Blur is still one slider away, per page.
 */
export const DEFAULT_PDF_PREVIEW_PREFERENCES: PdfPreviewPreferences = {
  previewPageCount: MAX_PDF_PREVIEW_PAGES,
  watermarkEnabled: true,
  watermarkText: "",
  blurStrength: 0,
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

/** What is applied to one page image. Each is the seller's to flip, per page. */
export type PdfPreviewProtection = {
  blur: boolean;
  watermark: boolean;
};

export type PdfPreviewSlot = {
  pageNumber: number;
  protection: PdfPreviewProtection;
};

export const UNPROTECTED: PdfPreviewProtection = { blur: false, watermark: false };

/**
 * What a single page is blurred at when the shop's slider sits at "ไม่เบลอ",
 * which is now where it starts. Without this, turning blur on for one page
 * would redraw it at a strength of zero and look like nothing happened.
 */
export const PAGE_BLUR_FALLBACK_STRENGTH = 8;

/** The strength one page's blur is drawn at, given the shop's setting. */
export function pageBlurStrength(blurStrength: number): number {
  return blurStrength > 0 ? blurStrength : PAGE_BLUR_FALLBACK_STRENGTH;
}

/** True when anything at all is drawn over the page as it was rendered. */
export function isProtected(protection: PdfPreviewProtection): boolean {
  return protection.blur || protection.watermark;
}

/**
 * The first page is the product's cover, so it stays exactly as the PDF draws
 * it. Every later preview page starts from the seller's settings, and the
 * product form lets them change any single page afterwards.
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
    protection:
      index === 0
        ? { ...UNPROTECTED }
        : {
            blur: preferences.watermarkEnabled && preferences.blurStrength > 0,
            watermark: preferences.watermarkEnabled,
          },
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
