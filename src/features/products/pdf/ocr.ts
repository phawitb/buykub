"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PSM } from "tesseract.js";

/**
 * Reads the characters off a PDF page image when the file has no text layer —
 * a scan, or a Thai export whose embedded fonts carry no ToUnicode map. The
 * recognizer runs entirely in the seller's browser, so the server receives the
 * same plain text it already receives from the text layer and carries no extra
 * load.
 */

/** Below this many characters the text layer is treated as unusable. */
export const OCR_TRIGGER_CHARS = 200;

/**
 * Recognition costs seconds per page on a phone, so only the opening pages are
 * read. A product sheet introduces itself well before page four.
 */
export const MAX_OCR_PAGES = 3;

/** Measured sweet spot: 150 dpi loses tone marks, 450 dpi invents Latin words. */
export const OCR_DPI = 300;

/** pdf.js viewport scale 1 is 72 dpi. */
const PDF_POINTS_PER_INCH = 72;

/** Keeps a rendered page inside the canvas limits of mobile Safari. */
const MAX_CANVAS_PIXELS = 12_000_000;
const MAX_CANVAS_EDGE = 4096;

const THAI_PATTERN = /[฀-๿]/;

export type OcrPage = { pageNumber: number; text: string };

export type OcrProgress = { completed: number; total: number };

export type OcrOptions = {
  pageCount: number;
  signal?: AbortSignal;
  onProgress?: (progress: OcrProgress) => void;
};

/**
 * Tesseract reports the Thai sara am as its two components, and drops stray
 * marks onto lines of their own. Both would reach the model as noise, so the
 * text is put back into the form a Thai reader expects.
 */
export function normalizeThaiText(raw: string): string {
  const lines = raw
    .normalize("NFC")
    // NIKHAHIT + SARA AA is how the recognizer spells SARA AM.
    .replace(/ํา/g, "ำ")
    .replace(/ํ([่-์])า/g, "$1ำ")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter(isReadableLine);

  const text: string[] = [];
  for (const line of lines) {
    // Collapse the blank runs the recognizer leaves between blocks.
    if (line || text.at(-1)) text.push(line);
  }
  return text.join("\n").trim();
}

/**
 * Keeps a line only if it carries something a reader could use. Ruling and
 * speckle come back as isolated punctuation and single digits, such as
 * "1 |    1 |", which would otherwise be offered to the model as content.
 */
export function isReadableLine(line: string): boolean {
  if (!line) return false;
  if (THAI_PATTERN.test(line)) return true;
  return /[0-9A-Za-z]{2,}/.test(line);
}

/** True when the text layer gave too little to draft from. */
export function needsOcr(pages: readonly { text: string }[]): boolean {
  const characters = pages.reduce((total, page) => total + page.text.replace(/\s+/g, "").length, 0);
  return characters < OCR_TRIGGER_CHARS;
}

/** The leading pages worth recognizing, given how long the document is. */
export function ocrPagePlan(pageCount: number): number[] {
  const pages = Math.min(MAX_OCR_PAGES, Math.max(0, pageCount));
  return Array.from({ length: pages }, (_, index) => index + 1);
}

/**
 * Renders at the resolution the recognizer reads best, shrinking only when a
 * page is large enough to exceed what a mobile browser will allocate.
 */
export function ocrRenderScale(width: number, height: number): number {
  const target = OCR_DPI / PDF_POINTS_PER_INCH;
  if (width <= 0 || height <= 0) return target;
  const byArea = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
  const byEdge = MAX_CANVAS_EDGE / Math.max(width, height);
  // The limits win even when they force a scale below 1: a page large enough
  // to need that is already huge in absolute pixels, and a canvas the browser
  // refuses to allocate would lose the whole page rather than some detail.
  return Math.min(target, byArea, byEdge);
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw new DOMException("ยกเลิกการอ่าน PDF แล้ว", "AbortError");
}

type TesseractModule = typeof import("tesseract.js");

let tesseractPromise: Promise<TesseractModule> | null = null;

function loadTesseract(): Promise<TesseractModule> {
  // Loaded on demand: a PDF with a text layer never pays for the engine.
  tesseractPromise ??= import("tesseract.js");
  return tesseractPromise;
}

/**
 * Recognizes the opening pages of an already-parsed document. Reusing the open
 * document avoids a second parse, and one recognizer serves every page.
 */
export async function ocrDocumentPages(
  document: PDFDocumentProxy,
  options: OcrOptions,
): Promise<OcrPage[]> {
  const plan = ocrPagePlan(options.pageCount);
  if (!plan.length) return [];

  throwIfAborted(options.signal);
  const { createWorker } = await loadTesseract();
  throwIfAborted(options.signal);

  const worker = await createWorker("tha", 1, {
    // Served from this origin by scripts/copy-ocr-assets.mjs.
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr",
    // The model is stored uncompressed and left to the CDN's own transport
    // compression. A pre-gzipped file is served with Content-Encoding by some
    // hosts, which the browser then unwraps, leaving the engine to inflate
    // bytes that are already plain.
    gzip: false,
    logger: () => undefined,
    errorHandler: () => undefined,
  });

  try {
    await worker.setParameters({
      // PSM.AUTO — a product sheet is a normal page, not a single line or word.
      // Spelled as its value so the enum can be a type-only import and the
      // engine stays out of the bundle until a scan actually needs it.
      tessedit_pageseg_mode: "3" as PSM,
      preserve_interword_spaces: "1",
      user_defined_dpi: String(OCR_DPI),
    });

    const pages: OcrPage[] = [];
    for (const [index, pageNumber] of plan.entries()) {
      throwIfAborted(options.signal);
      options.onProgress?.({ completed: index, total: plan.length });

      const page = await document.getPage(pageNumber);
      const canvas = window.document.createElement("canvas");
      try {
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: ocrRenderScale(base.width, base.height) });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("เบราว์เซอร์นี้ไม่รองรับการอ่านตัวอักษรจากรูป");
        // Transparent areas read as black without a page behind them.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, viewport }).promise;

        const { data } = await worker.recognize(canvas, {}, { text: true, blocks: false });
        const text = normalizeThaiText(data.text ?? "");
        if (text) pages.push({ pageNumber, text });
      } finally {
        page.cleanup();
        // A 300 dpi A4 page holds ~35 MB of pixels; release it before the next.
        canvas.width = 0;
        canvas.height = 0;
      }
    }

    options.onProgress?.({ completed: plan.length, total: plan.length });
    return pages;
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}
