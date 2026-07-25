"use client";

import DOMPurify from "isomorphic-dompurify";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductFileUploader } from "@/features/products/components/ProductFileUploader";
import { ProductImageUploader } from "@/features/products/components/ProductImageUploader";
import { RichTextEditor } from "@/features/products/components/RichTextEditor";
import {
  FAQFields,
  HighlightFields,
} from "@/features/products/components/RepeatableFields";
import type {
  ProductEditorValue,
  ProductFieldErrors,
} from "@/features/products/model";
import {
  slugifyProductName,
  uniqueProductSlug,
} from "@/features/products/slug";
import { validateProductEditor } from "@/features/products/validation";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = [
  "PROMPT PACK",
  "E-BOOK",
  "TEMPLATE",
  "COURSE",
  "PRESET",
  "GRAPHIC",
  "FONT",
  "MUSIC",
  "OTHER",
];

export type ProductEditorProps = {
  mode: "create" | "edit";
  shopId: string;
  userId: string;
  existingSlugs: string[];
  initialValue: ProductEditorValue;
  productId?: string;
};

function visibleText(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }).trim();
}

export function ProductEditor({
  mode,
  shopId,
  userId,
  existingSlugs,
  initialValue,
  productId,
}: ProductEditorProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [errors, setErrors] = useState<ProductFieldErrors>({});
  const [fileUploading, setFileUploading] = useState(false);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const currentErrors = useMemo(() => validateProductEditor(value), [value]);
  const canSave =
    Object.keys(currentErrors).length === 0 &&
    !fileUploading &&
    !imagesUploading &&
    !saving;

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty && !fileUploading && !imagesUploading) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, fileUploading, imagesUploading]);

  function update(patch: Partial<ProductEditorValue>) {
    setValue((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validateProductEditor(value);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setSaveError(null);
    const supabase = createClient();
    const sanitizedHtml = DOMPurify.sanitize(value.descriptionHtml, {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "src"],
    });
    const payload = {
      shop_id: shopId,
      name: value.name.trim(),
      description: visibleText(sanitizedHtml),
      description_html: sanitizedHtml,
      category: value.category,
      price_cents: Math.round(Number(value.price) * 100),
      compare_price_cents: value.comparePrice
        ? Math.round(Number(value.comparePrice) * 100)
        : null,
      highlights: value.highlights.map((item) => item.trim()).filter(Boolean),
      faq: value.faq
        .map((item) => ({
          id: item.id,
          question: item.question.trim(),
          answer: item.answer.trim(),
        }))
        .filter((item) => item.question && item.answer),
      images: value.images.map((image) => image.publicUrl),
      images_v2: value.images,
      file_path: value.productFile!.path,
      file_name: value.productFile!.fileName,
      file_size: value.productFile!.size,
      file_mime_type: value.productFile!.mimeType,
      published: value.published,
      updated_at: new Date().toISOString(),
    };

    if (mode === "create") {
      const slug = uniqueProductSlug(
        slugifyProductName(value.name),
        existingSlugs,
      );
      const { error } = await supabase
        .from("products")
        .insert({ ...payload, slug });
      if (error) {
        setSaveError(`สร้างสินค้าไม่สำเร็จ: ${error.message}`);
        setSaving(false);
        return;
      }
      setDirty(false);
      router.push("/dashboard/products");
      router.refresh();
      return;
    }

    const { error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", productId!)
      .eq("shop_id", shopId);
    if (error) {
      setSaveError(`บันทึกสินค้าไม่สำเร็จ: ${error.message}`);
      setSaving(false);
      return;
    }
    setDirty(false);
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="product-editor">
      <div>
        <p className="text-sm text-muted">
          <button
            type="button"
            onClick={() => router.push("/dashboard/products")}
            className="hover:text-ink"
          >
            สินค้า
          </button>{" "}
          <span className="mx-1">/</span>{" "}
          {mode === "create" ? "สร้างสินค้าใหม่" : "แก้ไขสินค้า"}
        </p>
        <h1 className="mt-5 text-2xl font-bold text-ink sm:text-3xl">
          {mode === "create" ? "สร้างสินค้าใหม่" : "แก้ไขสินค้า"}
        </h1>
      </div>

      <section className="product-section">
        <h2 className="product-section-title">ข้อมูลสินค้า</h2>
        <div className="mt-5 space-y-5">
          <label className="field-label">
            ชื่อสินค้า *
            <input
              value={value.name}
              onChange={(event) => update({ name: event.target.value })}
              placeholder="เช่น 100 ChatGPT Prompts Pack"
              className="field-input mt-2"
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              ราคา (บาท) *
              <span className="relative mt-2 block">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                  ฿
                </span>
                <input
                  value={value.price}
                  type="number"
                  min="0"
                  step="0.01"
                  onChange={(event) => update({ price: event.target.value })}
                  placeholder="199"
                  className="field-input pl-9"
                  aria-invalid={Boolean(errors.price)}
                />
              </span>
              {errors.price && <span className="field-error">{errors.price}</span>}
            </label>
            <label className="field-label">
              ราคาเดิม (ถ้ามี)
              <span className="relative mt-2 block">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                  ฿
                </span>
                <input
                  value={value.comparePrice}
                  type="number"
                  min="0"
                  step="0.01"
                  onChange={(event) =>
                    update({ comparePrice: event.target.value })
                  }
                  placeholder="399"
                  className="field-input pl-9"
                  aria-invalid={Boolean(errors.comparePrice)}
                />
              </span>
              {errors.comparePrice && (
                <span className="field-error">{errors.comparePrice}</span>
              )}
            </label>
          </div>

          <fieldset>
            <legend className="field-label">หมวดหมู่</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  aria-pressed={value.category === category}
                  onClick={() => update({ category })}
                  className={`category-chip ${
                    value.category === category ? "category-chip-active" : ""
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <p className="field-label mb-2">รายละเอียด</p>
            <RichTextEditor
              value={value.descriptionHtml}
              onChange={(descriptionHtml) => update({ descriptionHtml })}
            />
          </div>
        </div>
      </section>

      <ProductFileUploader
        userId={userId}
        value={value.productFile}
        onChange={(productFile) => update({ productFile })}
        onUploadingChange={setFileUploading}
      />
      {errors.productFile && (
        <p className="-mt-8 text-xs text-red-600">{errors.productFile}</p>
      )}

      <ProductImageUploader
        userId={userId}
        value={value.images}
        onChange={(images) => update({ images })}
        onUploadingChange={setImagesUploading}
      />

      <HighlightFields
        value={value.highlights}
        onChange={(highlights) => update({ highlights })}
      />
      <FAQFields value={value.faq} onChange={(faq) => update({ faq })} />

      {saveError && (
        <p className="text-sm text-red-600" role="alert">
          {saveError}
        </p>
      )}

      <div className="sticky bottom-0 -mx-5 flex justify-end gap-3 border-t border-line bg-paper/95 px-5 py-5 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0">
        <button
          type="button"
          onClick={() => router.push("/dashboard/products")}
          className="secondary-button"
        >
          ยกเลิก
        </button>
        <button type="submit" disabled={!canSave} className="primary-button">
          {saving
            ? "กำลังบันทึก..."
            : mode === "create"
              ? "สร้างสินค้า"
              : "บันทึกการเปลี่ยนแปลง"}
        </button>
      </div>
    </form>
  );
}
