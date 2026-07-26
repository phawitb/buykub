"use client";

import DOMPurify from "isomorphic-dompurify";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  findNewProductAssets,
  findRemovedProductAssets,
} from "@/features/products/asset-cleanup";
import { ProductFileUploader } from "@/features/products/components/ProductFileUploader";
import { ProductImageUploader } from "@/features/products/components/ProductImageUploader";
import { ProductKeyInventory } from "@/features/products/components/ProductKeyInventory";
import { RichTextEditor } from "@/features/products/components/RichTextEditor";
import {
  FAQFields,
  HighlightFields,
} from "@/features/products/components/RepeatableFields";
import type {
  ProductEditorValue,
  ProductFieldErrors,
  ProductKeyRecord,
} from "@/features/products/model";
import {
  slugifyProductName,
  uniqueProductSlug,
} from "@/features/products/slug";
import { validateProductEditor } from "@/features/products/validation";
import { parseProductKeys } from "@/features/products/product-keys";
import { createClient } from "@/lib/supabase/client";
import { deleteShopAsset } from "@/lib/supabase/upload";
import type { UploadDestination } from "@/lib/supabase/upload";

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
  initialKeyRecords?: ProductKeyRecord[];
  saveProduct?: (payload: Record<string, unknown>) => Promise<void>;
  deleteAsset?: (destination: UploadDestination, path: string) => Promise<void>;
};

function visibleText(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }).trim();
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "กรุณาลองอีกครั้ง";
}

export function ProductEditor({
  mode,
  shopId,
  userId,
  existingSlugs,
  initialValue,
  productId,
  initialKeyRecords = [],
  saveProduct,
  deleteAsset = deleteShopAsset,
}: ProductEditorProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [errors, setErrors] = useState<ProductFieldErrors>({});
  const [fileUploading, setFileUploading] = useState(false);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [keyRecords, setKeyRecords] = useState(initialKeyRecords);
  const persistedValue = useRef(initialValue);
  const draftStorageKey = `framelink-product-draft-assets:${userId}`;

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

  useEffect(() => {
    const staleDraft = window.localStorage.getItem(draftStorageKey);
    if (!staleDraft) return;
    window.localStorage.removeItem(draftStorageKey);
    try {
      const assets = JSON.parse(staleDraft) as Array<{
        destination: UploadDestination;
        path: string;
      }>;
      void Promise.allSettled(
        assets.map((asset) => deleteAsset(asset.destination, asset.path)),
      );
    } catch {
      // Ignore a corrupt local draft record; it never contains file contents.
    }
  }, [deleteAsset, draftStorageKey]);

  useEffect(() => {
    const assets = findNewProductAssets(persistedValue.current, value);
    if (assets.length) {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(assets));
    } else {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey, value]);

  useEffect(() => {
    const interceptNavigation = (event: MouseEvent) => {
      if (!dirty && !fileUploading && !imagesUploading) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.origin !== window.location.origin
      ) {
        return;
      }
      event.preventDefault();
      if (
        !window.confirm(
          "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?",
        )
      ) {
        return;
      }
      void cleanupDraftAssets().finally(() =>
        router.push(`${anchor.pathname}${anchor.search}${anchor.hash}`),
      );
    };
    document.addEventListener("click", interceptNavigation, true);
    return () => document.removeEventListener("click", interceptNavigation, true);
  });

  function update(patch: Partial<ProductEditorValue>) {
    setValue((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  async function cleanupDraftAssets() {
    await Promise.allSettled(
      findNewProductAssets(persistedValue.current, value).map((asset) =>
        deleteAsset(asset.destination, asset.path),
      ),
    );
    window.localStorage.removeItem(draftStorageKey);
  }

  async function changeKeyStatus(
    id: string,
    status: "available" | "disabled",
  ) {
    const previous = keyRecords.find((record) => record.id === id);
    if (!previous || previous.status === "assigned") return;
    const supabase = createClient();
    const { error } = await supabase
      .from("product_keys")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("product_id", productId!);
    if (error) {
      setSaveError(`อัปเดต Key ไม่สำเร็จ: ${error.message}`);
      return;
    }
    setKeyRecords((records) =>
      records.map((record) =>
        record.id === id ? { ...record, status } : record,
      ),
    );
    setValue((current) => ({
      ...current,
      keyInventory: {
        ...current.keyInventory,
        available:
          current.keyInventory.available +
          (status === "available" ? 1 : -1),
        disabled:
          current.keyInventory.disabled +
          (status === "disabled" ? 1 : -1),
      },
    }));
  }

  async function leaveEditor() {
    if (
      (dirty || fileUploading || imagesUploading) &&
      !window.confirm("มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?")
    ) {
      return;
    }
    await cleanupDraftAssets();
    router.push("/dashboard/products");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validateProductEditor(value);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setSaveError(null);
    setSavedMessage(null);
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
      delivery_type: value.deliveryType,
      file_path: value.deliveryType === "file" ? value.productFile?.path : null,
      file_name:
        value.deliveryType === "file" ? value.productFile?.fileName : null,
      file_size: value.deliveryType === "file" ? value.productFile?.size : null,
      file_mime_type:
        value.deliveryType === "file" ? value.productFile?.mimeType : null,
      published: value.published,
      updated_at: new Date().toISOString(),
    };

    if (mode === "create") {
      const slug = uniqueProductSlug(
        slugifyProductName(value.name),
        existingSlugs,
      );
      try {
        if (saveProduct) {
          await saveProduct({
            ...payload,
            slug,
            product_keys:
              value.deliveryType === "key"
                ? parseProductKeys(value.keyInput).keys
                : [],
          });
        } else {
          const supabase = createClient();
          const { data: createdProduct, error } = await supabase
            .from("products")
            .insert({ ...payload, slug })
            .select("id")
            .single();
          if (error) throw error;
          if (value.deliveryType === "key") {
            const { error: keyError } = await supabase.rpc(
              "import_product_keys",
              {
                p_product_id: createdProduct.id,
                p_keys: parseProductKeys(value.keyInput).keys,
              },
            );
            if (keyError) {
              await supabase.from("products").delete().eq("id", createdProduct.id);
              throw keyError;
            }
          }
        }
      } catch (error) {
        setSaveError(
          `สร้างสินค้าไม่สำเร็จ: ${
            errorMessage(error)
          }`,
        );
        setSaving(false);
        return;
      }
      setDirty(false);
      window.localStorage.removeItem(draftStorageKey);
      router.push("/dashboard/products");
      router.refresh();
      return;
    }

    let insertedKeyCount = 0;
    try {
      if (saveProduct) {
        insertedKeyCount =
          value.deliveryType === "key"
            ? parseProductKeys(value.keyInput).keys.length
            : 0;
        await saveProduct({
          ...payload,
          product_keys:
            value.deliveryType === "key"
              ? parseProductKeys(value.keyInput).keys
              : [],
        });
      } else {
        const supabase = createClient();
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", productId!)
          .eq("shop_id", shopId);
        if (error) throw error;
        if (value.deliveryType === "key") {
          const { data: keyResult, error: keyError } = await supabase.rpc(
            "import_product_keys",
            {
              p_product_id: productId!,
              p_keys: parseProductKeys(value.keyInput).keys,
            },
          );
          if (keyError) throw keyError;
          const resultRow = Array.isArray(keyResult) ? keyResult[0] : keyResult;
          insertedKeyCount = Number(resultRow?.inserted_count ?? 0);
        }
      }
    } catch (error) {
      setSaveError(
        `บันทึกสินค้าไม่สำเร็จ: ${
          errorMessage(error)
        }`,
      );
      setSaving(false);
      return;
    }
    await Promise.allSettled(
      findRemovedProductAssets(persistedValue.current, value).map((asset) =>
        deleteAsset(asset.destination, asset.path),
      ),
    );
    const savedValue =
      value.deliveryType === "key"
        ? {
            ...value,
            keyInput: "",
            keyInventory: {
              ...value.keyInventory,
              available: value.keyInventory.available + insertedKeyCount,
            },
          }
        : value;
    persistedValue.current = savedValue;
    setValue(savedValue);
    window.localStorage.removeItem(draftStorageKey);
    setDirty(false);
    setSaving(false);
    setSavedMessage("บันทึกสินค้าเรียบร้อยแล้ว");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="product-editor">
      <div>
        <p className="text-sm text-muted">
          <button
            type="button"
            onClick={() => void leaveEditor()}
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

      <section className="product-section">
        <h2 className="product-section-title">รูปแบบการส่งมอบ</h2>
        <p className="product-help">
          เลือกสิ่งที่ลูกค้าจะได้รับทันทีหลังชำระเงิน
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            {
              value: "file" as const,
              title: "ไฟล์ดาวน์โหลด",
              description: "PDF, ZIP, วิดีโอ หรือไฟล์ดิจิทัล",
            },
            {
              value: "key" as const,
              title: "Product Key",
              description: "จ่าย Key ไม่ซ้ำหนึ่งรายการต่อออเดอร์",
            },
          ].map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-2xl border p-4 transition ${
                value.deliveryType === option.value
                  ? "border-accent bg-accent-soft"
                  : "border-line hover:border-ink/30"
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="delivery-type"
                  value={option.value}
                  checked={value.deliveryType === option.value}
                  onChange={() => update({ deliveryType: option.value })}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">
                    {option.title}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted">
                    {option.description}
                  </span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {value.deliveryType === "file" ? (
        <>
          <ProductFileUploader
            userId={userId}
            value={value.productFile}
            onChange={(productFile) => update({ productFile })}
            onUploadingChange={setFileUploading}
          />
          {errors.productFile && (
            <p className="-mt-8 text-xs text-red-600">{errors.productFile}</p>
          )}
        </>
      ) : (
        <ProductKeyInventory
          value={value.keyInput}
          onChange={(keyInput) => update({ keyInput })}
          summary={value.keyInventory}
          records={keyRecords}
          error={errors.productKeys}
          onStatusChange={mode === "edit" ? changeKeyStatus : undefined}
        />
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
      {savedMessage && (
        <p
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
          role="status"
        >
          {savedMessage}
        </p>
      )}

      <div className="sticky bottom-0 -mx-5 flex justify-end gap-3 border-t border-line bg-paper/95 px-5 py-5 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0">
        <button
          type="button"
          onClick={() => void leaveEditor()}
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
