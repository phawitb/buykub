"use client";

import {
  MAX_PDF_PAGE_CHARS,
  MAX_PDF_TEXT_PAGES,
  pdfPreviewPlan,
  type PdfPreviewPreferences,
} from "@/features/products/pdf/preferences";
import { drawProtectedPreview } from "@/features/products/pdf/watermark";

export type PdfPageText = {
  pageNumber: number;
  text: string;
};

export type PdfPreviewImage = {
  pageNumber: number;
  protected: boolean;
  file: File;
  previewUrl: string;
};

export type PdfExtraction = {
  pageCount: number;
  pages: PdfPageText[];
  previews: PdfPreviewImage[];
  /** True when the document is longer than the pages that were read. */
  truncated: boolean;
};

export type PdfExtractProgress = {
  phase: "reading" | "rendering";
  completed: number;
  total: number;
};

export type PdfExtractOptions = {
  preferences: PdfPreviewPreferences;
  watermarkText: string;
  signal?: AbortSignal;
  onProgress?: (progress: PdfExtractProgress) => void;
};

/** Wide enough for a storefront gallery without producing multi-megabyte files. */
const PREVIEW_TARGET_WIDTH = 1200;

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
  })();
  return pdfModulePromise;
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw new DOMException("ยกเลิกการอ่าน PDF แล้ว", "AbortError");
}

function pageText(items: readonly unknown[]): string {
  let text = "";
  for (const item of items) {
    if (!item || typeof item !== "object" || !("str" in item)) continue;
    const entry = item as { str?: unknown; hasEOL?: unknown };
    if (typeof entry.str !== "string") continue;
    text += entry.str;
    if (entry.hasEOL === true) text += "\n";
    else if (!entry.str.endsWith(" ")) text += " ";
  }
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function canvasToFile(
  canvas: HTMLCanvasElement,
  fileName: string,
): Promise<File> {
  for (const type of ["image/webp", "image/jpeg"] as const) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, 0.82),
    );
    if (blob && blob.type === type) {
      const extension = type === "image/webp" ? "webp" : "jpg";
      return new File([blob], `${fileName}.${extension}`, { type });
    }
  }
  throw new Error("สร้างรูปตัวอย่างจาก PDF ไม่สำเร็จ");
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
    const pages: PdfPageText[] = [];

    for (let pageNumber = 1; pageNumber <= textPageCount; pageNumber += 1) {
      throwIfAborted(options.signal);
      options.onProgress?.({ phase: "reading", completed: pageNumber - 1, total: textPageCount });
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const text = pageText(content.items).slice(0, MAX_PDF_PAGE_CHARS);
        if (text) pages.push({ pageNumber, text });
      } finally {
        page.cleanup();
      }
    }

    for (const [index, slot] of plan.entries()) {
      throwIfAborted(options.signal);
      options.onProgress?.({ phase: "rendering", completed: index, total: plan.length });
      const page = await document.getPage(slot.pageNumber);
      try {
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2, Math.max(0.5, PREVIEW_TARGET_WIDTH / base.width));
        const viewport = page.getViewport({ scale });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("เบราว์เซอร์นี้ไม่รองรับการสร้างรูปจาก PDF");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, viewport }).promise;

        const output = slot.protect
          ? drawProtectedPreview(canvas, {
              blurStrength: options.preferences.blurStrength,
              watermarkOpacity: options.preferences.watermarkOpacity,
              watermarkText: options.watermarkText,
            })
          : canvas;

        const image = await canvasToFile(output, `page-${slot.pageNumber}`);
        previews.push({
          pageNumber: slot.pageNumber,
          protected: slot.protect,
          file: image,
          previewUrl: URL.createObjectURL(image),
        });
      } finally {
        page.cleanup();
      }
    }

    options.onProgress?.({ phase: "rendering", completed: plan.length, total: plan.length });
    return { pageCount, pages, previews, truncated: pageCount > textPageCount };
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
