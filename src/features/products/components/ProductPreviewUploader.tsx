"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductPreviewImage } from "@/features/products/model";
import { canvasToFile } from "@/features/products/pdf/encode";
import { pageBlurStrength } from "@/features/products/pdf/preferences";
import { drawProtectedPreview, type ProtectedPreviewOptions } from "@/features/products/pdf/watermark";
import { MAX_PREVIEW_IMAGES } from "@/features/products/previews";
import {
  deleteShopAsset,
  uploadShopAsset,
  type UploadDestination,
  type UploadRequest,
  type UploadResult,
} from "@/lib/supabase/upload";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";

export type PreviewProtection = { blur: boolean; watermark: boolean };
export type RenderedPreview = { file: File; width: number; height: number };
export type RenderPreview = (
  source: File,
  protection: PreviewProtection,
  options: ProtectedPreviewOptions,
) => Promise<RenderedPreview>;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** The source can be a phone photo; what is uploaded is redrawn and much smaller. */
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_EDGE = 2000;
/** A new sample is marked, not blurred: most sellers want it readable but not reusable. */
const DEFAULT_PROTECTION: PreviewProtection = { blur: false, watermark: true };

/**
 * Redraws the seller's image with its blur and watermark baked in. Every
 * sample is redrawn, protected or not, so camera metadata never reaches the
 * public bucket and a huge photo arrives at a sensible size.
 */
export const renderPreviewImage: RenderPreview = async (source, protection, options) => {
  const bitmap = await createImageBitmap(source);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("เบราว์เซอร์นี้ไม่รองรับการแก้ไขรูปตัวอย่าง");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // The shop's strength is tuned for PDF pages; a large photo needs more to read as blurred.
    const blur = protection.blur
      ? Math.max(pageBlurStrength(options.blurStrength), Math.round(Math.max(canvas.width, canvas.height) / 120))
      : 0;
    const text = protection.watermark ? options.watermarkText : "";
    const drawn = blur || text.trim()
      ? drawProtectedPreview(canvas, { ...options, blurStrength: blur, watermarkText: text })
      : canvas;
    const file = await canvasToFile(drawn, "preview");
    return { file, width: drawn.width, height: drawn.height };
  } finally {
    bitmap.close();
  }
};

type Props = {
  userId: string;
  value: ProductPreviewImage[];
  onChange: (previews: ProductPreviewImage[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  /** The shop's watermark style; the text starts from the shop's own label. */
  protectionOptions: ProtectedPreviewOptions;
  uploadAsset?: (request: UploadRequest) => Promise<UploadResult>;
  deleteAsset?: (destination: UploadDestination, path: string) => Promise<void>;
  renderPreview?: RenderPreview;
};

type Pending = { id: string; name: string; error: string | null };

export function ProductPreviewUploader({
  userId,
  value,
  onChange,
  onUploadingChange,
  protectionOptions,
  uploadAsset = uploadShopAsset,
  deleteAsset = deleteShopAsset,
  renderPreview = renderPreviewImage,
}: Props) {
  const [watermarkText, setWatermarkText] = useState(protectionOptions.watermarkText);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  // Clean originals stay in this tab only, so a sample can be re-protected
  // without stacking a second mark; they are never uploaded.
  const sources = useRef(new Map<string, File>());
  const latest = useRef(value);
  useEffect(() => { latest.current = value; }, [value]);

  const uploading = pending.some((item) => !item.error) || busy.length > 0;
  useEffect(() => { onUploadingChange?.(uploading); }, [onUploadingChange, uploading]);

  const options = (): ProtectedPreviewOptions => ({ ...protectionOptions, watermarkText: watermarkText.trim() || protectionOptions.watermarkText });

  async function publish(source: File, protection: PreviewProtection) {
    const rendered = await renderPreview(source, protection, options());
    const result = await uploadAsset({
      userId,
      file: rendered.file,
      destination: "product-image",
      signal: new AbortController().signal,
      onProgress: () => undefined,
    });
    return { path: result.path, publicUrl: result.publicUrl!, width: rendered.width, height: rendered.height, ...protection };
  }

  function commit(next: ProductPreviewImage[]) {
    latest.current = next;
    onChange(next);
  }

  async function add(file: File, id: string) {
    try {
      const uploaded = await publish(file, DEFAULT_PROTECTION);
      sources.current.set(id, file);
      commit([...latest.current, { id, ...uploaded }]);
      setPending((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      setPending((current) => current.map((item) => item.id === id
        ? { ...item, error: error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ" }
        : item));
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const problems: string[] = [];
    let room = MAX_PREVIEW_IMAGES - latest.current.length - pending.filter((item) => !item.error).length;
    const accepted: Array<{ file: File; id: string }> = [];
    for (const file of Array.from(list)) {
      if (room <= 0) problems.push(`${file.name}: เพิ่มรูปตัวอย่างได้สูงสุด ${MAX_PREVIEW_IMAGES} รูป`);
      else if (!IMAGE_TYPES.has(file.type)) problems.push(`${file.name}: รองรับเฉพาะ JPG, PNG และ WebP`);
      else if (file.size > MAX_SOURCE_BYTES) problems.push(`${file.name}: รูปต้องมีขนาดไม่เกิน 20 MB`);
      else { accepted.push({ file, id: crypto.randomUUID() }); room -= 1; }
    }
    setErrors(problems);
    setPending((current) => [...current, ...accepted.map(({ file, id }) => ({ id, name: file.name, error: null }))]);
    accepted.forEach(({ file, id }) => void add(file, id));
    if (inputRef.current) inputRef.current.value = "";
  }

  /** Redraws one sample from its clean original and swaps the uploaded file. */
  async function toggle(preview: ProductPreviewImage, field: keyof PreviewProtection) {
    const source = sources.current.get(preview.id);
    if (!source || busy.includes(preview.id)) return;
    setBusy((current) => [...current, preview.id]);
    setErrors([]);
    try {
      const uploaded = await publish(source, { blur: preview.blur, watermark: preview.watermark, [field]: !preview[field] });
      commit(latest.current.map((item) => (item.id === preview.id ? { ...item, ...uploaded } : item)));
      void deleteAsset("product-image", preview.path).catch(() => undefined);
    } catch {
      setErrors(["ปรับรูปตัวอย่างไม่สำเร็จ กรุณาลองอีกครั้ง"]);
    } finally {
      setBusy((current) => current.filter((id) => id !== preview.id));
    }
  }

  function remove(preview: ProductPreviewImage) {
    sources.current.delete(preview.id);
    commit(latest.current.filter((item) => item.id !== preview.id));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  const full = value.length + pending.filter((item) => !item.error).length >= MAX_PREVIEW_IMAGES;

  return (
    <section className="product-section" aria-labelledby="product-previews-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="product-section-title" id="product-previews-title">รูปตัวอย่าง (Preview)</h2>
          <p className="product-help">
            แสดงใต้ &ldquo;สิ่งที่คุณจะได้รับ&rdquo; ในหน้าสินค้า ตั้งเบลอหรือลายน้ำได้ทีละรูป —
            เบลอและลายน้ำจะถูกฝังลงในรูปก่อนอัปโหลด รูปต้นฉบับไม่ถูกเผยแพร่
          </p>
        </div>
        <span className="text-xs text-muted">{value.length}/{MAX_PREVIEW_IMAGES}</span>
      </div>

      <label className="mt-4 block max-w-sm">
        <span className="field-label">ข้อความลายน้ำ</span>
        <input
          className="field-input mt-1"
          value={watermarkText}
          maxLength={60}
          onChange={(event) => setWatermarkText(event.target.value)}
        />
        <span className="mt-1 block text-xs text-muted">ใช้กับรูปที่เพิ่ม หรือเปิดลายน้ำ หลังจากแก้ข้อความ</span>
      </label>

      {(value.length > 0 || pending.length > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((preview, index) => {
            const editable = sources.current.has(preview.id);
            const working = busy.includes(preview.id);
            return (
              <div key={preview.id} className="image-upload-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.publicUrl} alt={`รูปตัวอย่าง ${index + 1}`} className={`block h-auto w-full rounded-xl ${working ? "opacity-60" : ""}`} />
                <div className="mt-2 flex items-center gap-1">
                  {(["blur", "watermark"] as const).map((field) => {
                    const label = field === "blur" ? "เบลอ" : "ลายน้ำ";
                    return (
                      <button
                        key={field}
                        type="button"
                        aria-pressed={preview[field]}
                        aria-label={`${label}รูปตัวอย่าง ${index + 1}`}
                        title={editable ? undefined : "รูปที่บันทึกไว้แล้ว ลบแล้วเพิ่มใหม่เพื่อเปลี่ยนการตั้งค่า"}
                        disabled={!editable || working}
                        onClick={() => void toggle(preview, field)}
                        className={`small-button px-2 ${preview[field] ? "border-accent font-semibold text-accent" : "text-muted"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  {working && <span className="text-[11px] text-muted" role="status">กำลังปรับ...</span>}
                </div>
                <div className="mt-2 flex gap-1">
                  <button type="button" className="icon-button" aria-label={`เลื่อนรูปตัวอย่าง ${index + 1} ไปซ้าย`} disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowLeftIcon className="size-3.5" />
                  </button>
                  <button type="button" className="icon-button" aria-label={`เลื่อนรูปตัวอย่าง ${index + 1} ไปขวา`} disabled={index === value.length - 1} onClick={() => move(index, 1)}>
                    <ArrowRightIcon className="size-3.5" />
                  </button>
                  <button type="button" className="small-button ml-auto text-red-600" onClick={() => remove(preview)}>ลบ</button>
                </div>
              </div>
            );
          })}
          {pending.map((item) => (
            <div key={item.id} className="image-upload-card flex min-h-32 flex-col justify-center text-center">
              <p className="truncate text-xs font-medium text-ink">{item.name}</p>
              {item.error ? (
                <>
                  <p className="mt-1 text-[11px] text-red-600" role="alert">{item.error}</p>
                  <button type="button" className="small-button mx-auto mt-2" onClick={() => setPending((current) => current.filter((entry) => entry.id !== item.id))}>ปิด</button>
                </>
              ) : (
                <p className="mt-1 text-[11px] text-muted" role="status">กำลังใส่ลายน้ำและอัปโหลด...</p>
              )}
            </div>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-red-600" role="alert">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}

      <input
        ref={inputRef}
        id="product-preview-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        aria-label="เลือกรูปตัวอย่าง"
        onChange={(event) => addFiles(event.target.files)}
      />
      <button type="button" className="secondary-button mt-4" disabled={full} onClick={() => inputRef.current?.click()}>
        + เพิ่มรูปตัวอย่าง
      </button>
    </section>
  );
}
