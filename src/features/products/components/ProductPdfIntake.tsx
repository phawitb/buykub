"use client";

import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/features/products/format";
import type { ProductImage, ProductUploadRecord } from "@/features/products/model";
import {
  extractPdf,
  releasePdfExtraction,
  type PdfExtraction,
  type PdfExtractProgress,
  type PdfPageSource,
  type PdfTextSource,
} from "@/features/products/pdf/extract";
import {
  MAX_PDF_TEXT_PAGES,
  watermarkLabel,
  type PdfPreviewPreferences,
} from "@/features/products/pdf/preferences";
import type { ProtectedPreviewOptions } from "@/features/products/pdf/watermark";
import { validateProductFile } from "@/features/products/validation";
import type { ProductDraft, ProductDraftResponse } from "@/lib/agent/model";
import { uploadShopAsset, type UploadRequest, type UploadResult } from "@/lib/supabase/upload";
import { ArrowUpIcon } from "@/components/icons";

/**
 * What the seller needs to know about a draft once it is already in the form:
 * what the agent could not work out, what the reading cost, and whether the
 * words came from recognizing images rather than from the file itself.
 */
export type PdfIntakeSummary = {
  fileName: string;
  notes: string;
  /** Null when nothing was billed, because the draft never arrived. */
  costMicros: number | null;
  /** True when the words were recognized from page images, which misspells. */
  scanned: boolean;
  textPagesRead: number;
};

export type PdfIntakeResult = {
  draft: ProductDraft;
  summary: PdfIntakeSummary;
  productFile: ProductUploadRecord;
  images: ProductImage[];
  /** The pages behind those images, so the form can re-protect any one of them. */
  pages: PdfPageSource[];
  protectionOptions: ProtectedPreviewOptions;
};

type Props = {
  userId: string;
  shopName: string | null;
  preferences: PdfPreviewPreferences;
  onApply: (result: PdfIntakeResult) => void;
  onSkip: () => void;
  requestDraft?: (body: DraftRequestBody) => Promise<ProductDraftResponse>;
  uploadAsset?: (request: UploadRequest) => Promise<UploadResult>;
};

const EMPTY_DRAFT: ProductDraft = {
  name: "",
  price: "",
  comparePrice: "",
  descriptionHtml: "",
  highlights: [],
  faq: [],
  imageAlt: "",
  notes: "",
};

type DraftRequestBody = {
  pages: { pageNumber: number; text: string }[];
  fileName: string;
  textSource: PdfTextSource;
};

async function postDraft(body: DraftRequestBody): Promise<ProductDraftResponse> {
  const response = await fetch("/api/agent/product-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as
    | (ProductDraftResponse & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? "AI ช่วยกรอกข้อมูลไม่สำเร็จ กรุณากรอกเอง");
  }
  if (!payload?.draft) throw new Error("AI ช่วยกรอกข้อมูลไม่สำเร็จ กรุณากรอกเอง");
  return payload;
}

/** Named so the seller can tell a slow OCR pass from a stalled upload. */
export function readingLabel(progress: PdfExtractProgress | null): string {
  if (progress?.phase === "ocr") {
    const page = Math.min(progress.completed + 1, progress.total);
    return `กำลังอ่านตัวอักษรจากรูป (OCR) หน้า ${page}/${progress.total}`;
  }
  if (progress?.phase === "rendering") {
    return `กำลังสร้างรูปตัวอย่าง ${progress.completed}/${progress.total}`;
  }
  return `กำลังอ่านไฟล์ ${progress?.completed ?? 0}/${progress?.total ?? MAX_PDF_TEXT_PAGES} หน้า`;
}

export function ProductPdfIntake({
  userId,
  shopName,
  preferences,
  onApply,
  onSkip,
  requestDraft = postDraft,
  uploadAsset = uploadShopAsset,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [extraction, setExtraction] = useState<PdfExtraction | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_DRAFT);
  const [draftUsage, setDraftUsage] = useState<ProductDraftResponse | null>(null);
  const [stage, setStage] = useState<"idle" | "reading" | "drafting" | "applying" | "failed">("idle");
  const [progress, setProgress] = useState<PdfExtractProgress | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const extractionRef = useRef<PdfExtraction | null>(null);

  useEffect(() => {
    extractionRef.current = extraction;
  }, [extraction]);

  useEffect(
    () => () => {
      controller.current?.abort();
      releasePdfExtraction(extractionRef.current);
    },
    [],
  );

  function reset() {
    controller.current?.abort();
    releasePdfExtraction(extractionRef.current);
    setFile(null);
    setExtraction(null);
    setDraft(EMPTY_DRAFT);
    setDraftUsage(null);
    setDraftError(null);
    setError(null);
    setStage("idle");
    setProgress(null);
    setUploadPercent(0);
  }

  function summaryOf(
    read: PdfExtraction,
    drafted: ProductDraft,
    usage: ProductDraftResponse | null,
    fileName: string,
  ): PdfIntakeSummary {
    return {
      fileName,
      notes: drafted.notes,
      costMicros: usage?.usage.costMicros ?? null,
      scanned: read.textSource === "ocr",
      textPagesRead: read.textPagesRead,
    };
  }

  /**
   * Uploads the file and its preview images, then hands everything to the form.
   * Nothing is held back for a second confirmation: every field the agent wrote
   * is editable where it lands, so the seller reviews it in the form itself.
   */
  async function apply(
    selected: File,
    read: PdfExtraction,
    drafted: ProductDraft,
    usage: ProductDraftResponse | null,
  ) {
    setStage("applying");
    setError(null);
    setUploadPercent(0);

    const abort = new AbortController();
    controller.current = abort;

    try {
      const fileResult = await uploadAsset({
        userId,
        file: selected,
        destination: "product-file",
        signal: abort.signal,
        onProgress: (percent) => setUploadPercent(percent),
      });
      const productFile: ProductUploadRecord = {
        path: fileResult.path,
        fileName: selected.name,
        size: selected.size,
        mimeType: selected.type || "application/pdf",
        pageCount: read.pageCount > 0 ? read.pageCount : null,
      };

      const images: ProductImage[] = [];
      const pages: PdfPageSource[] = [];
      for (const preview of read.previews) {
        const result = await uploadAsset({
          userId,
          file: preview.file,
          destination: "product-image",
          signal: abort.signal,
          onProgress: () => undefined,
        });
        const imageId = crypto.randomUUID();
        pages.push({
          imageId,
          pageNumber: preview.pageNumber,
          protection: preview.protection,
          source: preview.source,
        });
        images.push({
          id: imageId,
          path: result.path,
          publicUrl: result.publicUrl!,
          alt:
            preview.pageNumber === 1 && drafted.imageAlt
              ? drafted.imageAlt
              : `ตัวอย่างหน้า ${preview.pageNumber}`,
        });
      }

      releasePdfExtraction(read);
      extractionRef.current = null;
      onApply({
        draft: drafted,
        summary: summaryOf(read, drafted, usage, selected.name),
        productFile,
        images,
        pages,
        protectionOptions: read.protectionOptions,
      });
    } catch (uploadError) {
      if (uploadError instanceof DOMException && uploadError.name === "AbortError") return;
      setStage("failed");
      setError(
        uploadError instanceof Error ? uploadError.message : "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    }
  }

  async function draftFrom(selected: File, read: PdfExtraction, signal: AbortSignal) {
    setDraftError(null);
    setError(null);
    setStage("drafting");
    try {
      const response = await requestDraft({
        pages: read.pages.map((page) => ({ pageNumber: page.pageNumber, text: page.text })),
        fileName: selected.name,
        textSource: read.textSource,
      });
      if (signal.aborted) return;
      setDraft(response.draft);
      setDraftUsage(response);
      await apply(selected, read, response.draft, response);
    } catch (agentError) {
      if (signal.aborted) return;
      setDraft(EMPTY_DRAFT);
      setDraftUsage(null);
      setStage("failed");
      setDraftError(
        agentError instanceof Error ? agentError.message : "AI ช่วยกรอกข้อมูลไม่สำเร็จ กรุณากรอกเอง",
      );
    }
  }

  async function start(selected: File) {
    if (selected.type !== "application/pdf" && !/\.pdf$/i.test(selected.name)) {
      setError("รองรับเฉพาะไฟล์ PDF");
      return;
    }
    const sizeError = validateProductFile(selected);
    if (sizeError) {
      setError(sizeError);
      return;
    }

    releasePdfExtraction(extractionRef.current);
    setError(null);
    setDraftError(null);
    setDraftUsage(null);
    setExtraction(null);
    setFile(selected);
    setStage("reading");
    setProgress(null);

    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;

    let read: PdfExtraction;
    try {
      read = await extractPdf(selected, {
        preferences,
        watermarkText: watermarkLabel(preferences, shopName),
        signal: abort.signal,
        onProgress: setProgress,
      });
    } catch (readError) {
      if (readError instanceof DOMException && readError.name === "AbortError") return;
      setStage("idle");
      setFile(null);
      setError(
        readError instanceof Error ? readError.message : "อ่านไฟล์ PDF ไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
      return;
    }
    if (abort.signal.aborted) {
      releasePdfExtraction(read);
      return;
    }
    setExtraction(read);
    await draftFrom(selected, read, abort.signal);
  }

  /**
   * Asks the agent again from the pages already read. The draft is the one step
   * that fails on its own account — the model's reasoning shares a token budget
   * with its answer, so a dense document can think its way past the ceiling and
   * return nothing — and the retry costs one request instead of re-reading the
   * file, because the text and the preview images are still in hand.
   */
  async function retryDraft() {
    if (!file || !extraction || stage !== "failed") return;
    const abort = new AbortController();
    controller.current = abort;
    await draftFrom(file, extraction, abort.signal);
  }

  /** Goes on to the form with whatever is in hand, drafted or not. */
  async function continueToForm() {
    if (!file || !extraction || stage !== "failed") return;
    await apply(file, extraction, draft, draftUsage);
  }

  const statusLabel =
    stage === "reading"
      ? readingLabel(progress)
      : stage === "drafting"
        ? "กำลังให้ AI ร่างข้อมูลสินค้า..."
        : "กำลังอัปโหลดไฟล์และรูป แล้วกรอกลงฟอร์ม";

  return (
    <section className="product-section border-b-0">
      <h2 className="product-section-title">เริ่มจากไฟล์ PDF</h2>
      <p className="product-help">
        อัปโหลดไฟล์ PDF ของสินค้า ระบบจะอ่าน {MAX_PDF_TEXT_PAGES} หน้าแรกเพื่อร่างชื่อ ราคา
        รายละเอียด และรูปสินค้าให้ แล้วกรอกลงฟอร์มให้เลย คุณแก้ได้ทุกช่องก่อนบันทึก
      </p>

      {stage === "idle" && (
        <>
          <label
            className="upload-dropzone mt-5"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const dropped = event.dataTransfer.files?.[0];
              if (dropped) void start(dropped);
            }}
          >
            <span className="upload-icon" aria-hidden="true">
              <ArrowUpIcon className="size-5" />
            </span>
            <span className="mt-3 text-sm font-semibold text-ink">
              ลากไฟล์ PDF มาวางที่นี่ หรือ <span className="text-accent">คลิกเพื่อเลือก</span>
            </span>
            <span className="mt-1 text-xs text-muted">ไฟล์เดียว สูงสุด 50.0 MB</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              aria-label="เลือกไฟล์ PDF ของสินค้า"
              className="sr-only"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                event.target.value = "";
                if (selected) void start(selected);
              }}
            />
          </label>
          {error && (
            <p className="mt-3 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          <button type="button" onClick={onSkip} className="small-button mt-5">
            ข้าม แล้วกรอกข้อมูลเอง
          </button>
        </>
      )}

      {(stage === "reading" || stage === "drafting" || stage === "applying") && (
        <div className="mt-5 space-y-4">
          <div className="upload-card">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{file?.name}</p>
              <p className="mt-1 text-xs text-muted" role="status">
                {statusLabel}
              </p>
              {stage === "reading" && progress?.phase === "ocr" && (
                <p className="mt-1 text-[11px] leading-4 text-muted">
                  ไฟล์นี้ไม่มีชั้นข้อความ ระบบจึงอ่านตัวอักษรจากรูปของแต่ละหน้าในเครื่องคุณเอง
                  ครั้งแรกจะดาวน์โหลดตัวอ่านประมาณ 2 MB แล้วเก็บไว้ใช้ครั้งต่อไป
                </p>
              )}
            </div>
            {stage !== "applying" && (
              <button type="button" onClick={reset} className="small-button shrink-0">
                ยกเลิก
              </button>
            )}
          </div>

          {stage === "applying" && (
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted">
                <span>กำลังอัปโหลดไฟล์และรูป</span>
                <span>{uploadPercent}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="กำลังอัปโหลดไฟล์สินค้า"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadPercent}
                className="progress-track"
              >
                <div className="progress-fill" style={{ width: `${uploadPercent}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {stage === "failed" && (
        <div className="mt-5 space-y-4">
          <div className="upload-card">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{file?.name}</p>
              <p className="mt-1 text-xs text-muted">
                {formatBytes(file?.size ?? 0)} · {extraction?.pageCount ?? 0} หน้า
                {extraction?.truncated && ` · อ่าน ${extraction.textPagesRead} หน้าแรก`}
              </p>
            </div>
            <button type="button" onClick={reset} className="small-button shrink-0">
              เปลี่ยนไฟล์
            </button>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-800" role="status">
              {draftError ?? error}
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              ระบบอ่านไฟล์นี้ไว้แล้ว ลองใหม่ได้โดยไม่ต้องอัปโหลดซ้ำ
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {draftError ? (
              <>
                <button type="button" onClick={() => void retryDraft()} className="primary-button">
                  ให้ AI ลองอีกครั้ง
                </button>
                <button
                  type="button"
                  onClick={() => void continueToForm()}
                  className="secondary-button"
                >
                  กรอกเองในฟอร์ม
                </button>
              </>
            ) : (
              <button type="button" onClick={() => void continueToForm()} className="primary-button">
                ลองอัปโหลดอีกครั้ง
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
