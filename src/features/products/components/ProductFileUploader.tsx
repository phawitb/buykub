"use client";

import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/features/products/format";
import { readPdfPageCount } from "@/features/products/pdf/extract";
import type { ProductUploadRecord } from "@/features/products/model";
import {
  createUploadTask,
  uploadTaskReducer,
} from "@/features/products/upload-task";
import { validateProductFile } from "@/features/products/validation";
import {
  uploadShopAsset,
  type UploadRequest,
  type UploadResult,
} from "@/lib/supabase/upload";
import { ArrowUpIcon } from "@/components/icons";

type Props = {
  userId: string;
  value: ProductUploadRecord | null;
  onChange: (value: ProductUploadRecord | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  uploadAsset?: (request: UploadRequest) => Promise<UploadResult>;
  readPageCount?: (file: File) => Promise<number | null>;
  /** A course's companion PDF: optional, and only a PDF is accepted. */
  coursePdf?: boolean;
};

const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);

export function ProductFileUploader({
  userId,
  value,
  onChange,
  onUploadingChange,
  uploadAsset = uploadShopAsset,
  readPageCount = readPdfPageCount,
  coursePdf = false,
}: Props) {
  const [task, setTask] = useState<ReturnType<typeof createUploadTask> | null>(
    null,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    onUploadingChange?.(task?.status === "uploading");
  }, [onUploadingChange, task?.status]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  /**
   * The storefront says how long the delivered PDF is, so a buyer does not
   * read the sample's own "3 / 5" as the length of the product. Counting the
   * pages is the seller's browser opening the file it is already holding; it
   * runs beside the upload, and a file it cannot read simply has no count.
   */
  async function pdfPageCount(file: File): Promise<number | null> {
    if (file.type !== "application/pdf") return null;
    try {
      return (await readPageCount(file)) ?? null;
    } catch {
      return null;
    }
  }

  async function startUpload(file: File) {
    const error = coursePdf && !isPdf(file) ? "รองรับเฉพาะไฟล์ PDF" : validateProductFile(file);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    const pageCount = pdfPageCount(file);
    const nextTask = createUploadTask(file);
    setTask(uploadTaskReducer(nextTask, { type: "START" }));
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const result = await uploadAsset({
        userId,
        file,
        destination: "product-file",
        signal: controller.signal,
        onProgress: (percent, sentBytes, totalBytes) => {
          setTask((current) =>
            current
              ? uploadTaskReducer(current, {
                  type: "PROGRESS",
                  percent,
                  sentBytes,
                  totalBytes,
                })
              : current,
          );
        },
      });
      setTask((current) =>
        current
          ? uploadTaskReducer(current, { type: "SUCCESS", result })
          : current,
      );
      onChange({
        path: result.path,
        fileName: file.name,
        size: file.size,
        mimeType: file.type || (isPdf(file) ? "application/pdf" : "application/octet-stream"),
        pageCount: await pageCount,
      });
    } catch (uploadError) {
      if (
        uploadError instanceof DOMException &&
        uploadError.name === "AbortError"
      ) {
        setTask((current) =>
          current
            ? uploadTaskReducer(current, { type: "CANCEL" })
            : current,
        );
      } else {
        setTask((current) =>
          current
            ? uploadTaskReducer(current, {
                type: "FAIL",
                message:
                  uploadError instanceof Error
                    ? uploadError.message
                    : "อัปโหลดไฟล์ไม่สำเร็จ",
              })
            : current,
        );
      }
    }
  }

  function chooseFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) void startUpload(file);
  }

  function cancel() {
    controllerRef.current?.abort();
  }

  function retry() {
    if (task?.file) void startUpload(task.file);
  }

  const displayedFile = task?.file
    ? {
        fileName: task.file.name,
        size: task.file.size,
      }
    : value;

  return (
    <section className="product-section">
      {coursePdf ? (
        <>
          <h2 className="product-section-title">ไฟล์ PDF ประกอบคอร์ส</h2>
          <p className="product-help">
            ไม่บังคับ — ผู้เรียนที่มีสิทธิ์เข้าเรียนจะดาวน์โหลดได้จากปุ่ม PDF ในรายการที่สั่งซื้อ
            และหมดสิทธิ์พร้อมคอร์ส — PDF 1 ไฟล์ ขนาดสูงสุด 50 MB
          </p>
        </>
      ) : (
        <>
          <h2 className="product-section-title">ไฟล์สินค้า *</h2>
          <p className="product-help">
            อัปโหลดไฟล์ดิจิทัลที่ลูกค้าจะได้รับหลังซื้อ — 1 ไฟล์ ขนาดสูงสุด 50
            MB (PDF, ZIP, EPUB, MP4 หรือไฟล์ใดก็ได้)
          </p>
        </>
      )}

      {displayedFile ? (
        <div className="upload-card mt-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">
              {displayedFile.fileName}
            </p>
            <p className="mt-1 text-xs text-muted">
              {formatBytes(displayedFile.size)}
            </p>

            {task?.status === "uploading" && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs text-muted">
                  <span>กำลังอัปโหลด</span>
                  <span>{task.percent}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="กำลังอัปโหลดไฟล์สินค้า"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={task.percent}
                  className="progress-track"
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${task.percent}%` }}
                  />
                </div>
              </div>
            )}

            {task?.status === "error" && (
              <p className="mt-3 text-xs text-red-600" role="alert">
                {task.error}
              </p>
            )}
            {task?.status === "success" && (
              <p className="mt-3 text-xs font-medium text-emerald-700">
                อัปโหลดสำเร็จ
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            {task?.status === "uploading" && (
              <button type="button" onClick={cancel} className="small-button">
                ยกเลิก
              </button>
            )}
            {task?.status === "error" && (
              <button type="button" onClick={retry} className="small-button">
                ลองใหม่
              </button>
            )}
            {task?.status !== "uploading" && (
              <>
                <label className="small-button cursor-pointer text-center">
                  เปลี่ยนไฟล์
                  <input
                    type="file"
                    accept={coursePdf ? ".pdf,application/pdf" : undefined}
                    aria-label="เปลี่ยนไฟล์สินค้า"
                    className="sr-only"
                    onChange={(event) => {
                      chooseFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setTask(null);
                  }}
                  className="small-button text-red-600"
                >
                  ลบ
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <label
          className="upload-dropzone mt-4"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            chooseFiles(event.dataTransfer.files);
          }}
        >
          <span className="upload-icon" aria-hidden="true">
            <ArrowUpIcon className="size-5" />
          </span>
          <span className="mt-3 text-sm font-semibold text-ink">
            ลากไฟล์มาวางที่นี่ หรือ{" "}
            <span className="text-accent">คลิกเพื่อเลือก</span>
          </span>
          <span className="mt-1 text-xs text-muted">สูงสุด 50.0 MB</span>
          <input
            type="file"
            accept={coursePdf ? ".pdf,application/pdf" : undefined}
            aria-label="เลือกไฟล์สินค้า"
            className="sr-only"
            onChange={(event) => {
              chooseFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      )}

      {validationError && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {validationError}
        </p>
      )}
    </section>
  );
}
