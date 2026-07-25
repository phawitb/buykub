"use client";

import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/features/products/format";
import type { ProductImage } from "@/features/products/model";
import { validateProductImages } from "@/features/products/validation";
import {
  uploadShopAsset,
  type UploadRequest,
  type UploadResult,
} from "@/lib/supabase/upload";

type ImageTask = {
  id: string;
  file: File;
  previewUrl: string;
  status: "uploading" | "success" | "error" | "canceled";
  percent: number;
  error: string | null;
  result: UploadResult | null;
};

type Props = {
  userId: string;
  value: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  uploadAsset?: (request: UploadRequest) => Promise<UploadResult>;
};

export function ProductImageUploader({
  userId,
  value,
  onChange,
  onUploadingChange,
  uploadAsset = uploadShopAsset,
}: Props) {
  const [tasks, setTasks] = useState<ImageTask[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const savedImagesRef = useRef(value);

  const uploading = tasks.some((task) => task.status === "uploading");

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [onUploadingChange, uploading]);

  useEffect(() => {
    savedImagesRef.current = value;
  }, [value]);

  useEffect(
    () => () => {
      controllers.current.forEach((controller) => controller.abort());
      tasks.forEach((task) => URL.revokeObjectURL(task.previewUrl));
    },
    // The cleanup intentionally captures the mounted task set through state
    // updates below, where removed previews are revoked immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function uploadTask(task: ImageTask) {
    const controller = new AbortController();
    controllers.current.set(task.id, controller);
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? { ...item, status: "uploading", percent: 0, error: null }
          : item,
      ),
    );

    try {
      const result = await uploadAsset({
        userId,
        file: task.file,
        destination: "product-image",
        signal: controller.signal,
        onProgress: (percent) => {
          setTasks((current) =>
            current.map((item) =>
              item.id === task.id ? { ...item, percent } : item,
            ),
          );
        },
      });
      const productImage: ProductImage = {
        id: task.id,
        path: result.path,
        publicUrl: result.publicUrl!,
        alt: task.file.name.replace(/\.[^.]+$/, ""),
      };
      const nextImages = [...savedImagesRef.current, productImage];
      savedImagesRef.current = nextImages;
      onChange(nextImages);
      URL.revokeObjectURL(task.previewUrl);
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (uploadError) {
      const canceled =
        uploadError instanceof DOMException &&
        uploadError.name === "AbortError";
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: canceled ? "canceled" : "error",
                error: canceled
                  ? null
                  : uploadError instanceof Error
                    ? uploadError.message
                    : "อัปโหลดรูปไม่สำเร็จ",
              }
            : item,
        ),
      );
    } finally {
      controllers.current.delete(task.id);
    }
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList);
    const validationErrors = validateProductImages(
      files,
      value.length + tasks.filter((task) => task.status !== "canceled").length,
    );
    setErrors(validationErrors.map((error) => `${error.fileName}: ${error.message}`));
    const invalidNames = new Set(validationErrors.map((error) => error.fileName));
    const validFiles = files.filter((file) => !invalidNames.has(file.name));

    const nextTasks = validFiles.map<ImageTask>((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "uploading",
      percent: 0,
      error: null,
      result: null,
    }));
    setTasks((current) => [...current, ...nextTasks]);
    nextTasks.forEach((task) => void uploadTask(task));
  }

  function removeSaved(image: ProductImage) {
    const nextImages = value.filter((item) => item.id !== image.id);
    savedImagesRef.current = nextImages;
    onChange(nextImages);
  }

  function moveSaved(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const reordered = [...value];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];
    savedImagesRef.current = reordered;
    onChange(reordered);
  }

  function removeTask(task: ImageTask) {
    controllers.current.get(task.id)?.abort();
    URL.revokeObjectURL(task.previewUrl);
    setTasks((current) => current.filter((item) => item.id !== task.id));
  }

  return (
    <section className="product-section">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="product-section-title">รูปสินค้า</h2>
          <p className="product-help">
            แนะนำ 1200 × 1200 px · 1:1 สี่เหลี่ยมจัตุรัส · JPG, PNG, WebP ·
            สูงสุด 5 MB ต่อรูป
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            <li>ⓘ รูปแรกจะเป็น thumbnail ในหน้าร้าน — เลือกรูปเด่นที่สุด</li>
            <li>ⓘ อัปได้สูงสุด 5 รูป — แนะนำ 3 รูปขึ้นไปเพื่อให้ลูกค้าเห็นหลายมุม</li>
          </ul>
        </div>
        <span className="text-xs text-muted">{value.length}/5</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {value.map((image, index) => (
          <div key={image.id} className="image-upload-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.publicUrl}
              alt={image.alt}
              className="aspect-square w-full rounded-xl object-cover"
            />
            {index === 0 && <span className="thumbnail-badge">รูปปก</span>}
            <div className="mt-2 flex flex-wrap gap-1">
              <button
                type="button"
                className="icon-button"
                aria-label={`เลื่อน ${image.alt} ไปซ้าย`}
                disabled={index === 0}
                onClick={() => moveSaved(index, -1)}
              >
                ←
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`เลื่อน ${image.alt} ไปขวา`}
                disabled={index === value.length - 1}
                onClick={() => moveSaved(index, 1)}
              >
                →
              </button>
              <button
                type="button"
                className="small-button ml-auto text-red-600"
                onClick={() => removeSaved(image)}
              >
                ลบ
              </button>
            </div>
          </div>
        ))}

        {tasks.map((task) => (
          <div key={task.id} className="image-upload-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={task.previewUrl}
              alt=""
              className="aspect-square w-full rounded-xl object-cover opacity-70"
            />
            <p className="mt-2 truncate text-xs font-medium text-ink">
              {task.file.name}
            </p>
            <p className="text-[11px] text-muted">{formatBytes(task.file.size)}</p>
            {task.status === "uploading" && (
              <>
                <div
                  role="progressbar"
                  aria-label={`กำลังอัปโหลด ${task.file.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={task.percent}
                  className="progress-track mt-2"
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${task.percent}%` }}
                  />
                </div>
                <button
                  type="button"
                  className="small-button mt-2"
                  onClick={() => controllers.current.get(task.id)?.abort()}
                >
                  ยกเลิก
                </button>
              </>
            )}
            {task.status === "error" && (
              <>
                <p className="mt-2 text-xs text-red-600">{task.error}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => void uploadTask(task)}
                  >
                    ลองใหม่
                  </button>
                  <button
                    type="button"
                    className="small-button text-red-600"
                    onClick={() => removeTask(task)}
                  >
                    ลบ
                  </button>
                </div>
              </>
            )}
            {task.status === "canceled" && (
              <button
                type="button"
                className="small-button mt-2"
                onClick={() => void uploadTask(task)}
              >
                อัปโหลดอีกครั้ง
              </button>
            )}
          </div>
        ))}

        {value.length + tasks.filter((task) => task.status !== "canceled").length <
          5 && (
          <label
            className="upload-dropzone aspect-square min-h-0"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addFiles(event.dataTransfer.files);
            }}
          >
            <span className="upload-icon" aria-hidden="true">
              ↑
            </span>
            <span className="mt-2 text-center text-xs font-semibold text-ink">
              ลากไฟล์มาวางที่นี่ หรือ
              <span className="block text-accent">คลิกเพื่อเลือก</span>
            </span>
            <span className="mt-1 text-[11px] text-muted">สูงสุด 5.0 MB</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              aria-label="เลือกรูปสินค้า"
              className="sr-only"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      {errors.map((error) => (
        <p key={error} className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      ))}
    </section>
  );
}
