"use client";

import { canvasToFile } from "@/features/products/pdf/encode";
import { fitPageToSquare } from "@/features/products/pdf/frame";
import { needsOcr, ocrDocumentPages, ocrPagePlan } from "@/features/products/pdf/ocr";
import {
  isProtected,
  MAX_PDF_PAGE_CHARS,
  MAX_PDF_TEXT_PAGES,
  pageBlurStrength,
  pdfPreviewPlan,
  type PdfPreviewPreferences,
  type PdfPreviewProtection,
} from "@/features/products/pdf/preferences";
import { withReadableShadings } from "@/features/products/pdf/shading";
import { joinTextItems } from "@/features/products/pdf/text";
import {
  drawProtectedPreview,
  type ProtectedPreviewOptions,
} from "@/features/products/pdf/watermark";

export type PdfPageText = {
  pageNumber: number;
  text: string;
};

/** Where the draft text came from, which the seller and the model both need. */
export type PdfTextSource = "layer" | "ocr" | "none";

export type PdfPreviewImage = {
  pageNumber: number;
  protection: PdfPreviewProtection;
  /** What is uploaded: the page with whatever protection is currently on. */
  file: File;
  previewUrl: string;
  /**
   * The page exactly as the PDF draws it. Kept so the seller can turn the blur
   * or the watermark on and off per page afterwards without re-reading the
   * file, which on a scanned document costs a minute of OCR.
   */
  source: File;
};

/**
 * One preview page as the form keeps it: the uploaded image it became, and the
 * clean render it can be rebuilt from when the seller changes that page's
 * protection.
 */
export type PdfPageSource = {
  /** The id of the ProductImage this page was uploaded as. */
  imageId: string;
  pageNumber: number;
  protection: PdfPreviewProtection;
  source: File;
};

export type PdfExtraction = {
  pageCount: number;
  pages: PdfPageText[];
  previews: PdfPreviewImage[];
  /** True when the document is longer than the pages that were read. */
  truncated: boolean;
  textSource: PdfTextSource;
  /** How many pages the text actually came from; OCR reads fewer than the layer. */
  textPagesRead: number;
  /** The settings a later per-page change re-renders with. */
  protectionOptions: ProtectedPreviewOptions;
};

export type PdfExtractProgress = {
  phase: "reading" | "ocr" | "rendering";
  completed: number;
  total: number;
};

export type PdfExtractOptions = {
  preferences: PdfPreviewPreferences;
  watermarkText: string;
  signal?: AbortSignal;
  onProgress?: (progress: PdfExtractProgress) => void;
};

/**
 * The side of the square each page is drawn into: large enough for a
 * storefront gallery without producing multi-megabyte files.
 */
const PREVIEW_TARGET_SIZE = 1200;

type PdfModule = typeof import("pdfjs-dist");

let pdfModulePromise: Promise<PdfModule> | null = null;

async function loadPdfModule(): Promise<PdfModule> {
  pdfModulePromise ??= (async () => {
    const pdfjs = await import("pdfjs-dist");
    if (!pdfjs.GlobalWorkerOptions.workerPort && !pdfjs.GlobalWorkerOptions.workerSrc) {
      // Bundler-resolved module worker: pdf.js parses off the main thread, so a
      // ten-page render never freezes the editor.
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
        { type: "module" },
      );
    }
    return pdfjs;
  })().catch((error) => {
    // A failed load must not be remembered: the next upload would inherit the
    // rejection and no page would ever render again in this tab.
    pdfModulePromise = null;
    throw error;
  });
  return pdfModulePromise;
}

/**
 * How many pages a PDF has, and nothing else. The storefront needs the number
 * for every file a seller attaches, including the ones that never went through
 * the drafting intake, and reading the page tree costs far less than rendering
 * anything. A file that cannot be opened returns null rather than failing the
 * upload: the count is a nicety, the file is the product.
 */
export async function readPdfPageCount(file: File): Promise<number | null> {
  try {
    const pdfjs = await loadPdfModule();
    const data = new Uint8Array(await file.arrayBuffer());
    const loadTask = pdfjs.getDocument({ data, isEvalSupported: false });
    try {
      const document = await loadTask.promise;
      const pageCount = document.numPages;
      await document.cleanup().catch(() => undefined);
      return pageCount > 0 ? pageCount : null;
    } finally {
      await loadTask.destroy().catch(() => undefined);
    }
  } catch {
    return null;
  }
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw new DOMException("ยกเลิกการอ่าน PDF แล้ว", "AbortError");
}

/**
 * Draws one page's protection onto a canvas holding the clean page. Blur and
 * watermark are independent, so each is switched off by the value that already
 * makes `drawProtectedPreview` skip it.
 */
function applyProtection(
  canvas: HTMLCanvasElement,
  protection: PdfPreviewProtection,
  options: ProtectedPreviewOptions,
): HTMLCanvasElement {
  if (!isProtected(protection)) return canvas;
  return drawProtectedPreview(canvas, {
    blurStrength: protection.blur ? pageBlurStrength(options.blurStrength) : 0,
    watermarkOpacity: options.watermarkOpacity,
    watermarkText: protection.watermark ? options.watermarkText : "",
  });
}

/**
 * Re-renders one preview page from the clean copy kept at extraction time, so
 * flipping blur or the watermark on a single page never stacks a second
 * watermark over the first.
 */
export async function renderPreviewFile(
  source: File,
  protection: PdfPreviewProtection,
  options: ProtectedPreviewOptions,
): Promise<File> {
  if (!isProtected(protection)) return source;
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = window.document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("เบราว์เซอร์นี้ไม่รองรับการแก้ไขรูปตัวอย่าง");
    context.drawImage(bitmap, 0, 0);
    const baseName = source.name.replace(/\.[^.]+$/, "") || "page";
    return canvasToFile(applyProtection(canvas, protection, options), baseName);
  } finally {
    bitmap.close();
  }
}

/**
 * Reads the leading pages of a PDF in the browser: their text for the draft
 * request, and the first pages as gallery images. The file itself never leaves
 * the browser for the draft — only text does.
 */
export async function extractPdf(
  file: File,
  options: PdfExtractOptions,
): Promise<PdfExtraction> {
  const pdfjs = await loadPdfModule();
  throwIfAborted(options.signal);

  const data = new Uint8Array(await file.arrayBuffer());
  const loadTask = pdfjs.getDocument({ data, isEvalSupported: false });
  options.signal?.addEventListener("abort", () => void loadTask.destroy(), { once: true });

  const document = await loadTask.promise;
  const previews: PdfPreviewImage[] = [];

  try {
    const pageCount = document.numPages;
    const textPageCount = Math.min(pageCount, MAX_PDF_TEXT_PAGES);
    const plan = pdfPreviewPlan(options.preferences, pageCount);
    const protectionOptions: ProtectedPreviewOptions = {
      blurStrength: options.preferences.blurStrength,
      watermarkOpacity: options.preferences.watermarkOpacity,
      watermarkText: options.watermarkText,
    };
    let pages: PdfPageText[] = [];

    for (let pageNumber = 1; pageNumber <= textPageCount; pageNumber += 1) {
      throwIfAborted(options.signal);
      options.onProgress?.({ phase: "reading", completed: pageNumber - 1, total: textPageCount });
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const text = joinTextItems(content.items).slice(0, MAX_PDF_PAGE_CHARS);
        if (text) pages.push({ pageNumber, text });
      } finally {
        page.cleanup();
      }
    }

    // A scan, or a Thai export whose fonts carry no ToUnicode map, leaves the
    // text layer empty or unreadable. Recognizing the rendered page recovers
    // the words without the file leaving the browser.
    let textSource: PdfTextSource = pages.length ? "layer" : "none";
    let textPagesRead = textPageCount;
    if (needsOcr(pages)) {
      try {
        const recognized = await ocrDocumentPages(document, {
          pageCount,
          signal: options.signal,
          onProgress: ({ completed, total }) =>
            options.onProgress?.({ phase: "ocr", completed, total }),
        });
        if (recognized.length) {
          pages = recognized.map((page) => ({
            pageNumber: page.pageNumber,
            text: page.text.slice(0, MAX_PDF_PAGE_CHARS),
          }));
          textSource = "ocr";
          textPagesRead = ocrPagePlan(pageCount).length;
        }
      } catch (ocrError) {
        if (ocrError instanceof DOMException && ocrError.name === "AbortError") throw ocrError;
        // The engine is a 2 MB download on first use. Losing it should cost the
        // seller the draft, not the upload: the preview images still follow and
        // the form stays fillable by hand.
        textSource = pages.length ? "layer" : "none";
      }
    }

    await withReadableShadings(async () => {
      for (const [index, slot] of plan.entries()) {
        throwIfAborted(options.signal);
        options.onProgress?.({ phase: "rendering", completed: index, total: plan.length });
        const page = await document.getPage(slot.pageNumber);
        try {
          const base = page.getViewport({ scale: 1 });
          // Fitted by the longer edge, so a page keeps its proportions and the
          // square it is centred in stays the same size whichever way it turns.
          const scale = Math.min(
            2,
            Math.max(0.5, PREVIEW_TARGET_SIZE / Math.max(base.width, base.height)),
          );
          const viewport = page.getViewport({ scale });
          const rendered = window.document.createElement("canvas");
          rendered.width = Math.round(viewport.width);
          rendered.height = Math.round(viewport.height);
          const context = rendered.getContext("2d");
          if (!context) throw new Error("เบราว์เซอร์นี้ไม่รองรับการสร้างรูปจาก PDF");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, rendered.width, rendered.height);
          await page.render({ canvas: rendered, viewport }).promise;

          const canvas = fitPageToSquare(rendered);
          const source = await canvasToFile(canvas, `page-${slot.pageNumber}`);
          const image = isProtected(slot.protection)
            ? await canvasToFile(
                applyProtection(canvas, slot.protection, protectionOptions),
                `page-${slot.pageNumber}`,
              )
            : source;
          previews.push({
            pageNumber: slot.pageNumber,
            protection: slot.protection,
            file: image,
            previewUrl: URL.createObjectURL(image),
            source,
          });
        } finally {
          page.cleanup();
        }
      }
    });

    options.onProgress?.({ phase: "rendering", completed: plan.length, total: plan.length });
    return {
      pageCount,
      pages,
      previews,
      truncated: pageCount > textPagesRead,
      textSource,
      textPagesRead,
      protectionOptions,
    };
  } catch (error) {
    previews.forEach((preview) => URL.revokeObjectURL(preview.previewUrl));
    throw error;
  } finally {
    await document.cleanup().catch(() => undefined);
    await loadTask.destroy().catch(() => undefined);
  }
}

export function releasePdfExtraction(extraction: PdfExtraction | null) {
  extraction?.previews.forEach((preview) => URL.revokeObjectURL(preview.previewUrl));
}
