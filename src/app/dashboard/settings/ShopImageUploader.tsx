"use client";

import { useEffect, useRef, useState } from "react";
import {
  uploadShopAsset,
  type UploadRequest,
  type UploadResult,
} from "@/lib/supabase/upload";

type Kind = "avatar" | "cover" | "service";
type Upload = (request: UploadRequest) => Promise<UploadResult>;

const CONFIG = {
  avatar: {
    label: "รูปโปรไฟล์",
    inputLabel: "เลือกรูปโปรไฟล์",
    hint:
      "แนะนำ 400 × 400 px · 1:1 สี่เหลี่ยมจัตุรัส · JPG, PNG, WebP · สูงสุด 2 MB",
    tips: ["ใช้รูปใบหน้าหรือโลโก้ พื้นหลังเรียบ"],
    maxBytes: 2 * 1024 * 1024,
  },
  cover: {
    label: "รูปปก",
    inputLabel: "เลือกรูปปก",
    hint:
      "แนะนำ 1600 × 500 px · 3:1 แนวนอน · JPG, PNG, WebP · สูงสุด 5 MB",
    tips: [
      "ใช้รูปแนวนอนเท่านั้น",
      "หลีกเลี่ยงข้อความสำคัญที่ขอบซ้าย — รูปโปรไฟล์จะทับ",
    ],
    maxBytes: 5 * 1024 * 1024,
  },
  service: {
    label: "รูปบริการ",
    inputLabel: "รูปบริการ",
    hint:
      "แนะนำ 1200 × 480 px · 2.5:1 แนวนอน · JPG, PNG, WebP · สูงสุด 5 MB",
    tips: [],
    maxBytes: 5 * 1024 * 1024,
  },
} satisfies Record<
  Kind,
  {
    label: string;
    inputLabel: string;
    hint: string;
    tips: string[];
    maxBytes: number;
  }
>;

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function ShopImageUploader({
  kind,
  userId,
  value,
  onUploaded,
  onBusyChange,
  upload = uploadShopAsset,
}: {
  kind: Kind;
  userId: string;
  value: string | null;
  onUploaded: (url: string, path: string) => void;
  onBusyChange?: (busy: boolean) => void;
  upload?: Upload;
}) {
  const config = CONFIG[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "success" | "error" | "canceled"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function validate(nextFile: File) {
    if (!ACCEPTED_TYPES.has(nextFile.type)) {
      return "รองรับเฉพาะไฟล์ JPG, PNG และ WebP";
    }
    if (nextFile.size > config.maxBytes) {
      return `ไฟล์ใหญ่เกิน ${config.maxBytes / 1024 / 1024} MB`;
    }
    return null;
  }

  async function startUpload(nextFile: File) {
    const validationError = validate(nextFile);
    setFile(nextFile);
    setError(validationError);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(nextFile));
    if (validationError) {
      setStatus("error");
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("uploading");
    setProgress(0);
    setError(null);
    onBusyChange?.(true);

    try {
      const result = await upload({
        userId,
        file: nextFile,
        destination: "product-image",
        signal: controller.signal,
        onProgress: (percent) => setProgress(percent),
      });
      if (!result.publicUrl) throw new Error("ไม่พบ URL ของรูปที่อัปโหลด");
      setProgress(100);
      setStatus("success");
      onUploaded(result.publicUrl, result.path);
    } catch (uploadError) {
      if (
        uploadError instanceof DOMException &&
        uploadError.name === "AbortError"
      ) {
        setStatus("canceled");
        setError("ยกเลิกการอัปโหลดแล้ว");
      } else {
        setStatus("error");
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "อัปโหลดรูปไม่สำเร็จ",
        );
      }
    } finally {
      controllerRef.current = null;
      onBusyChange?.(false);
    }
  }

  function choose(nextFile: File | undefined) {
    if (nextFile) void startUpload(nextFile);
    if (inputRef.current) inputRef.current.value = "";
  }

  const displayedUrl = previewUrl ?? value;

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink-soft">{config.label}</p>
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          choose(event.dataTransfer.files[0]);
        }}
        className={`rounded-xl border border-dashed bg-paper p-3 transition ${
          dragging ? "border-accent bg-accent-soft" : "border-line"
        }`}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-lg text-center"
        >
          {displayedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayedUrl}
              alt=""
              className={
                kind === "avatar"
                  ? "h-16 w-16 rounded-full object-cover"
                  : "h-20 w-full rounded-lg object-cover"
              }
            />
          ) : (
            <span
              aria-hidden
              className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-dim text-lg text-muted"
            >
              ↑
            </span>
          )}
          <span className="text-xs font-medium text-ink-soft">
            ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือก
          </span>
          <span className="text-[11px] text-muted">{config.hint}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          aria-label={config.inputLabel}
          onChange={(event) => choose(event.target.files?.[0])}
          className="sr-only"
        />

        {status === "uploading" && (
          <div className="mt-3 border-t border-line pt-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-ink-soft">
                {file?.name}
              </span>
              <span className="font-semibold tabular-nums text-ink">
                {progress}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={
                kind === "service"
                  ? "กำลังอัปโหลดรูปบริการ"
                  : `ความคืบหน้าการอัปโหลด${config.label}`
              }
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-dim"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => controllerRef.current?.abort()}
              className="mt-3 text-xs font-medium text-muted underline underline-offset-4 hover:text-ink"
            >
              ยกเลิก
            </button>
          </div>
        )}

        {(status === "error" || status === "canceled") && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
            {file && !validate(file) && (
              <button
                type="button"
                onClick={() => void startUpload(file)}
                className="shrink-0 text-xs font-semibold text-ink underline underline-offset-4"
              >
                ลองใหม่
              </button>
            )}
          </div>
        )}

        {status === "success" && (
          <p className="mt-3 border-t border-line pt-3 text-xs font-medium text-emerald-700">
            อัปโหลดสำเร็จ
          </p>
        )}
      </div>
      {config.tips.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] leading-5 text-muted">
          {config.tips.map((tip) => (
            <li key={tip}>ⓘ {tip}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
