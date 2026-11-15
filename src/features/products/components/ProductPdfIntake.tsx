"use client";

import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/features/products/format";
import type { ProductImage, ProductUploadRecord } from "@/features/products/model";
import {
  extractPdf,
  releasePdfExtraction,
  type PdfExtraction,
  type PdfExtractProgress,
  type PdfTextSource,
} from "@/features/products/pdf/extract";
import {
  MAX_PDF_TEXT_PAGES,
  watermarkLabel,
  type PdfPreviewPreferences,
} from "@/features/products/pdf/preferences";
import { validateProductFile } from "@/features/products/validation";
import type { ProductDraft, ProductDraftResponse } from "@/lib/agent/model";
import { formatUsd } from "@/lib/agent/pricing";
import { uploadShopAsset, type UploadRequest, type UploadResult } from "@/lib/supabase/upload";
import { ArrowUpIcon } from "@/components/icons";

export type PdfIntakeResult = {
  draft: ProductDraft;
  applied: DraftSelection;
  productFile: ProductUploadRecord;
  images: ProductImage[];
};

type DraftSelection = {
  name: boolean;
  price: boolean;
  description: boolean;
  highlights: boolean;
  faq: boolean;
  images: boolean;
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

function htmlToLines(html: string): string[] {
  return html
    .split(/<\/p>/i)
    .map((block) => block.replace(/<[^>]*>/g, "").trim())
    .filter(Boolean)
    .map((text) =>
      text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&"),
    );
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

function defaultSelection(draft: ProductDraft, hasImages: boolean): DraftSelection {
  return {
    name: Boolean(draft.name),
    price: Boolean(draft.price),
    description: Boolean(draft.descriptionHtml),
    highlights: draft.highlights.length > 0,
    faq: draft.faq.length > 0,
    images: hasImages,
  };
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
  const [selection, setSelection] = useState<DraftSelection>(() => defaultSelection(EMPTY_DRAFT, false));
  const [stage, setStage] = useState<"idle" | "reading" | "drafting" | "review" | "applying">("idle");
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
    setStage("idle");
    setProgress(null);
    setUploadPercent(0);
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
    setStage("drafting");

    try {
      const response = await requestDraft({
        pages: read.pages.map((page) => ({ pageNumber: page.pageNumber, text: page.text })),
        fileName: selected.name,
        textSource: read.textSource,
      });
      if (abort.signal.aborted) return;
      setDraft(response.draft);
      setDraftUsage(response);
      setSelection(defaultSelection(response.draft, read.previews.length > 0));
    } catch (agentError) {
      if (abort.signal.aborted) return;
      setDraft(EMPTY_DRAFT);
      setSelection(defaultSelection(EMPTY_DRAFT, read.previews.length > 0));
      setDraftError(
        agentError instanceof Error ? agentError.message : "AI ช่วยกรอกข้อมูลไม่สำเร็จ กรุณากรอกเอง",
      );
    }
    setStage("review");
  }

  async function confirm() {
    if (!file || !extraction) return;
    setStage("applying");
    setError(null);
    setUploadPercent(0);

    const abort = new AbortController();
    controller.current = abort;
    const selectedPreviews = selection.images ? extraction.previews : [];

    try {
      const fileResult = await uploadAsset({
        userId,
        file,
        destination: "product-file",
        signal: abort.signal,
        onProgress: (percent) => setUploadPercent(percent),
      });
      const productFile: ProductUploadRecord = {
        path: fileResult.path,
        fileName: file.name,
        size: file.size,
        mimeType: file.type || "application/pdf",
      };

      const images: ProductImage[] = [];
      for (const preview of selectedPreviews) {
        const result = await uploadAsset({
          userId,
          file: preview.file,
          destination: "product-image",
          signal: abort.signal,
          onProgress: () => undefined,
        });
        images.push({
          id: crypto.randomUUID(),
          path: result.path,
          publicUrl: result.publicUrl!,
          alt:
            preview.pageNumber === 1 && draft.imageAlt
              ? draft.imageAlt
              : `ตัวอย่างหน้า ${preview.pageNumber}`,
        });
      }

      releasePdfExtraction(extraction);
      extractionRef.current = null;
      onApply({ draft, applied: selection, productFile, images });
    } catch (uploadError) {
      if (uploadError instanceof DOMException && uploadError.name === "AbortError") {
        setStage("review");
        return;
      }
      setStage("review");
      setError(
        uploadError instanceof Error ? uploadError.message : "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    }
  }

  const busy = stage === "reading" || stage === "drafting" || stage === "applying";
  const descriptionLines = htmlToLines(draft.descriptionHtml);

  function toggle(key: keyof DraftSelection) {
    setSelection((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <section className="product-section border-b-0">
      <h2 className="product-section-title">เริ่มจากไฟล์ PDF</h2>
      <p className="product-help">
        อัปโหลดไฟล์ PDF ของสินค้า ระบบจะอ่าน {MAX_PDF_TEXT_PAGES} หน้าแรกเพื่อร่างชื่อ ราคา
        รายละเอียด และรูปสินค้าให้ แล้วคุณตรวจก่อนยืนยันทุกครั้ง
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

      {(stage === "reading" || stage === "drafting") && (
        <div className="upload-card mt-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{file?.name}</p>
            <p className="mt-1 text-xs text-muted" role="status">
              {stage === "reading" ? readingLabel(progress) : "กำลังให้ AI ร่างข้อมูลสินค้า..."}
            </p>
            {stage === "reading" && progress?.phase === "ocr" && (
              <p className="mt-1 text-[11px] leading-4 text-muted">
                ไฟล์นี้ไม่มีชั้นข้อความ ระบบจึงอ่านตัวอักษรจากรูปของแต่ละหน้าในเครื่องคุณเอง
                ครั้งแรกจะดาวน์โหลดตัวอ่านประมาณ 2 MB แล้วเก็บไว้ใช้ครั้งต่อไป
              </p>
            )}
          </div>
          <button type="button" onClick={reset} className="small-button shrink-0">
            ยกเลิก
          </button>
        </div>
      )}

      {(stage === "review" || stage === "applying") && (
        <div className="mt-5 space-y-5">
          <div className="upload-card">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{file?.name}</p>
              <p className="mt-1 text-xs text-muted">
                {formatBytes(file?.size ?? 0)} · {extraction?.pageCount ?? 0} หน้า
                {extraction?.truncated && ` · อ่าน ${extraction.textPagesRead} หน้าแรก`}
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              disabled={stage === "applying"}
              className="small-button shrink-0"
            >
              เปลี่ยนไฟล์
            </button>
          </div>

          {extraction?.textSource === "ocr" && (
            <p
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800"
              role="status"
            >
              ไฟล์นี้ไม่มีชั้นข้อความ (น่าจะเป็นไฟล์สแกน) ระบบอ่านตัวอักษรจากรูปของ{" "}
              {extraction.textPagesRead} หน้าแรกให้แล้ว การอ่านแบบนี้สะกดคำพลาดได้
              <strong className="font-semibold"> กรุณาตรวจราคาและชื่อสินค้าให้ละเอียดก่อนยืนยัน</strong>
            </p>
          )}

          {draftError ? (
            <p
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              role="status"
            >
              {draftError}
            </p>
          ) : (
            <div className="rounded-2xl border border-line bg-paper-dim px-4 py-3">
              <p className="text-sm font-semibold text-ink">ตรวจข้อมูลที่ AI ร่างไว้</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                เอาเครื่องหมายถูกออกได้ถ้าไม่ต้องการใช้ช่องนั้น ข้อมูลจะยังแก้ได้ในฟอร์มหลังจากยืนยัน
                {draftUsage && ` · ค่าใช้จ่ายครั้งนี้ ${formatUsd(draftUsage.usage.costMicros)}`}
              </p>
              {draft.notes && <p className="mt-3 text-xs leading-5 text-ink-soft">{draft.notes}</p>}
            </div>
          )}

          <ul className="divide-y divide-line rounded-2xl border border-line">
            <ReviewRow
              label="ชื่อสินค้า"
              checked={selection.name}
              disabled={!draft.name || stage === "applying"}
              onToggle={() => toggle("name")}
            >
              {draft.name || <Missing />}
            </ReviewRow>
            <ReviewRow
              label="ราคา"
              checked={selection.price}
              disabled={!draft.price || stage === "applying"}
              onToggle={() => toggle("price")}
            >
              {draft.price ? (
                <>
                  ฿{Number(draft.price).toLocaleString("th-TH")}
                  {draft.comparePrice && (
                    <span className="ml-2 text-muted line-through">
                      ฿{Number(draft.comparePrice).toLocaleString("th-TH")}
                    </span>
                  )}
                </>
              ) : (
                <Missing />
              )}
            </ReviewRow>
            <ReviewRow
              label="รายละเอียด"
              checked={selection.description}
              disabled={!descriptionLines.length || stage === "applying"}
              onToggle={() => toggle("description")}
            >
              {descriptionLines.length ? (
                <span className="space-y-1.5">
                  {descriptionLines.map((line, index) => (
                    <span key={index} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              ) : (
                <Missing />
              )}
            </ReviewRow>
            <ReviewRow
              label="จุดเด่น"
              checked={selection.highlights}
              disabled={!draft.highlights.length || stage === "applying"}
              onToggle={() => toggle("highlights")}
            >
              {draft.highlights.length ? (
                <span className="block space-y-1">
                  {draft.highlights.map((item, index) => (
                    <span key={index} className="block">
                      · {item}
                    </span>
                  ))}
                </span>
              ) : (
                <Missing />
              )}
            </ReviewRow>
            <ReviewRow
              label="คำถามที่พบบ่อย"
              checked={selection.faq}
              disabled={!draft.faq.length || stage === "applying"}
              onToggle={() => toggle("faq")}
            >
              {draft.faq.length ? (
                <span className="block space-y-2">
                  {draft.faq.map((item) => (
                    <span key={item.id} className="block">
                      <span className="font-medium text-ink">{item.question}</span>
                      <span className="mt-0.5 block">{item.answer}</span>
                    </span>
                  ))}
                </span>
              ) : (
                <Missing />
              )}
            </ReviewRow>
            <ReviewRow
              label="รูปสินค้าจาก PDF"
              checked={selection.images}
              disabled={!extraction?.previews.length || stage === "applying"}
              onToggle={() => toggle("images")}
            >
              {extraction?.previews.length ? (
                <span className="mt-1 flex flex-wrap gap-3">
                  {extraction.previews.map((preview) => (
                    <span key={preview.pageNumber} className="block w-28">
                      {/* Object URL of a canvas render; next/image cannot optimize a blob. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview.previewUrl}
                        alt={`ตัวอย่างหน้า ${preview.pageNumber}`}
                        className="aspect-3/4 w-28 rounded-element border border-line object-cover"
                      />
                      <span className="mt-1.5 block text-[11px] text-muted">
                        หน้า {preview.pageNumber}
                        {preview.protected ? " · ลายน้ำ + เบลอ" : " · รูปหลัก"}
                      </span>
                    </span>
                  ))}
                </span>
              ) : (
                <Missing />
              )}
            </ReviewRow>
          </ul>

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

          {error && (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy}
              className="primary-button"
            >
              {stage === "applying" ? "กำลังเตรียมฟอร์ม..." : "ยืนยันและกรอกลงฟอร์ม"}
            </button>
            <button
              type="button"
              onClick={onSkip}
              disabled={busy}
              className="secondary-button"
            >
              ไม่ใช้ แล้วกรอกเอง
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Missing() {
  return <span className="text-muted">— ไม่มีข้อมูล กรอกเองในฟอร์ม</span>;
}

function ReviewRow({
  label,
  checked,
  disabled,
  onToggle,
  children,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="p-4">
      <label className="flex gap-3">
        <input
          type="checkbox"
          checked={checked && !disabled}
          disabled={disabled}
          onChange={onToggle}
          className="mt-0.5 size-4 shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">{label}</span>
          <span className="mt-1 block text-sm leading-6 text-ink-soft">{children}</span>
        </span>
      </label>
    </li>
  );
}
