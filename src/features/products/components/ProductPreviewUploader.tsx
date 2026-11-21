"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductPreviewImage } from "@/features/products/model";
import { canvasToFile } from "@/features/products/pdf/encode";
import { pageBlurStrength } from "@/features/products/pdf/preferences";
import { drawProtectedPreview, type ProtectedPreviewOptions } from "@/features/products/pdf/watermark";
import { MAX_PREVIEW_IMAGES } from "@/features/products/previews";
import { createClient } from "@/lib/supabase/client";
import {
  deleteShopAsset,
  uploadShopAsset,
  type UploadDestination,
  type UploadRequest,
  type UploadResult,
} from "@/lib/supabase/upload";

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
const CLEAN: PreviewProtection = { blur: false, watermark: false };

/** Reads a clean original back from the owner's private folder. */
async function downloadPreviewSource(path: string): Promise<Blob> {
  const { data, error } = await createClient().storage.from("product-files").download(path);
  if (error || !data) throw new Error("โหลดรูปต้นฉบับไม่สำเร็จ");
  return data;
}

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
  downloadSource?: (path: string) => Promise<Blob>;
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
  downloadSource = downloadPreviewSource,
}: Props) {
  const [watermarkText, setWatermarkText] = useState(protectionOptions.watermarkText);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  /** The sample picked to swap places with the next one tapped. */
  const [picked, setPicked] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Clean originals, so a sample can be re-protected without stacking a
  // second mark. Each is also kept privately for later visits.
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

  /** Uploads the clean original, redrawn so camera metadata is dropped, to the private bucket. */
  async function keepSource(file: File) {
    const clean = await renderPreview(file, CLEAN, options());
    const result = await uploadAsset({
      userId,
      file: clean.file,
      destination: "product-file",
      signal: new AbortController().signal,
      onProgress: () => undefined,
    });
    return result.path;
  }

  async function add(file: File, id: string) {
    try {
      const [uploaded, sourcePath] = await Promise.all([publish(file, DEFAULT_PROTECTION), keepSource(file)]);
      sources.current.set(id, file);
      commit([...latest.current, { id, ...uploaded, sourcePath }]);
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

  async function sourceFor(preview: ProductPreviewImage): Promise<File> {
    const held = sources.current.get(preview.id);
    if (held) return held;
    const blob = await downloadSource(preview.sourcePath!);
    const file = new File([blob], "source.jpg", { type: blob.type || "image/jpeg" });
    sources.current.set(preview.id, file);
    return file;
  }

  /** Redraws one sample from its clean original and swaps the uploaded file. */
  async function toggle(preview: ProductPreviewImage, field: keyof PreviewProtection) {
    if (busy.includes(preview.id)) return;
    if (!sources.current.has(preview.id) && !preview.sourcePath) return;
    setBusy((current) => [...current, preview.id]);
    setErrors([]);
    try {
      const source = await sourceFor(preview);
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
    if (picked === preview.id) setPicked(null);
    commit(latest.current.filter((item) => item.id !== preview.id));
  }

  /** The first tap picks a sample, the second swaps it with another (or puts it back). */
  function pick(preview: ProductPreviewImage) {
    if (!picked || picked === preview.id) {
      setPicked(picked ? null : preview.id);
      return;
    }
    const from = value.findIndex((item) => item.id === picked);
    const to = value.findIndex((item) => item.id === preview.id);
    setPicked(null);
    if (from < 0 || to < 0) return;
    const next = [...value];
    [next[from], next[to]] = [next[to], next[from]];
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
            เบลอและลายน้ำจะถูกฝังลงในรูปก่อนเผยแพร่ ส่วนรูปต้นฉบับเก็บไว้เป็นไฟล์ส่วนตัวเพื่อให้ปรับทีหลังได้
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

      {value.length > 1 && (
        <p className="mt-4 text-xs text-muted" role="status">
          {picked ? "แตะรูปที่ต้องการสลับตำแหน่งด้วย หรือแตะรูปเดิมเพื่อยกเลิก" : "แตะรูปหนึ่ง แล้วแตะอีกรูปเพื่อสลับตำแหน่ง"}
        </p>
      )}

      {(value.length > 0 || pending.length > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((preview, index) => {
            const editable = sources.current.has(preview.id) || Boolean(preview.sourcePath);
            const working = busy.includes(preview.id);
            const selected = picked === preview.id;
            return (
              <div key={preview.id} className={`image-upload-card ${selected ? "ring-2 ring-accent" : ""}`}>
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={selected ? `ยกเลิกเลือกรูปตัวอย่าง ${index + 1}` : picked ? `สลับกับรูปตัวอย่าง ${index + 1}` : `เลือกรูปตัวอย่าง ${index + 1} เพื่อสลับตำแหน่ง`}
                  onClick={() => pick(preview)}
                  className="relative block w-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.publicUrl} alt="" className={`block h-auto w-full rounded-xl ${working ? "opacity-60" : ""}`} />
                  <span className={`absolute left-2 top-2 flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums shadow-lift-1 ${selected ? "bg-accent text-white" : "bg-paper text-ink"}`}>
                    {index + 1}
                  </span>
                </button>
                <div className="mt-2 flex items-center gap-1">
                  {(["blur", "watermark"] as const).map((field) => {
                    const label = field === "blur" ? "เบลอ" : "ลายน้ำ";
                    return (
                      <button
                        key={field}
                        type="button"
                        aria-pressed={preview[field]}
                        aria-label={`${label}รูปตัวอย่าง ${index + 1}`}
                        title={editable ? undefined : "รูปนี้ไม่มีต้นฉบับเก็บไว้ ลบแล้วเพิ่มใหม่เพื่อเปลี่ยนการตั้งค่า"}
                        disabled={!editable || working}
                        onClick={() => void toggle(preview, field)}
                        className={`small-button px-2 ${preview[field] ? "border-accent font-semibold text-accent" : "text-muted"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  {working && <span className="text-[11px] text-muted" role="status">กำลังปรับ...</span>}
                  <button type="button" className="small-button ml-auto text-red-600" aria-label={`ลบรูปตัวอย่าง ${index + 1}`} onClick={() => remove(preview)}>ลบ</button>
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
