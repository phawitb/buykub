"use client";

import { invalidatePublicCatalog, CATALOG_REFRESH_WARNING } from "@/lib/storefront/invalidate";

import Link from "next/link";
import { useWorkspaceDialog } from "./WorkspaceDialog";
import { productDraftKey, useProductDrafts } from "./ProductDraftProvider";
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
import {
  ProductPdfIntake,
  type PdfIntakeResult,
  type PdfIntakeSummary,
} from "@/features/products/components/ProductPdfIntake";
import {
  DEFAULT_PDF_PREVIEW_PREFERENCES,
  watermarkLabel,
  type PdfPreviewPreferences,
} from "@/features/products/pdf/preferences";
import { ProductPreviewUploader } from "@/features/products/components/ProductPreviewUploader";
import type { PdfPageSource } from "@/features/products/pdf/extract";
import type { ProtectedPreviewOptions } from "@/features/products/pdf/watermark";
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
import { productCategory } from "@/features/products/category";
import { affiliateRateBasisPoints, isBlankProductValue, MIN_PRICE_BAHT, validateProductEditor } from "@/features/products/validation";
import { parseProductKeys } from "@/features/products/product-keys";
import { createClient } from "@/lib/supabase/client";
import { isMissingColumnError, writeWithoutMissingColumn } from "@/lib/supabase/missing-column";
import { deleteShopAsset } from "@/lib/supabase/upload";
import type { UploadDestination } from "@/lib/supabase/upload";
import { formatUsd } from "@/lib/agent/pricing";
import { ArrowRightIcon } from "@/components/icons";

/** One object, so showing nothing never re-renders the fields. */
const NO_FIELD_ERRORS: ProductFieldErrors = {};

const PRODUCT_TYPES = [
  { value: "course", title: "Course", description: "คอร์สเรียน พร้อมบทเรียน วิดีโอ และเอกสาร" },
  { value: "file", title: "File", description: "ไฟล์ดาวน์โหลด เช่น PDF, ZIP หรือวิดีโอ" },
] as const;

export type ProductEditorProps = {
  mode: "create" | "edit";
  shopId: string;
  userId: string;
  existingSlugs: string[];
  initialValue: ProductEditorValue;
  productId?: string;
  initialKeyRecords?: ProductKeyRecord[];
  shopName?: string | null;
  pdfPreferences?: PdfPreviewPreferences;
  saveProduct?: (payload: Record<string, unknown>) => Promise<void>;
  deleteAsset?: (destination: UploadDestination, path: string) => Promise<void>;
};

function visibleText(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }).trim();
}

/**
 * Writes the product row on databases with or without the newer optional
 * columns. A missing page count is dropped quietly; missing preview images
 * are only dropped when there are none to keep, so a seller's samples are
 * never silently lost.
 */
function writeProductRow<T>(
  row: Record<string, unknown>,
  hasPreviews: boolean,
  run: (body: Record<string, unknown>) => Promise<T>,
): Promise<T> {
  const withPages = (body: Record<string, unknown>) => writeWithoutMissingColumn(body, "file_page_count", run);
  if (!hasPreviews) return writeWithoutMissingColumn(row, "preview_images", withPages);
  return withPages(row).catch((error: unknown) => {
    if (isMissingColumnError(error, "preview_images")) {
      throw new Error("ระบบยังไม่พร้อมบันทึกรูปตัวอย่าง (รอการอัปเดตฐานข้อมูล) — ลบรูปตัวอย่างออกก่อนแล้วบันทึกอีกครั้ง");
    }
    throw error;
  });
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

export function ProductEditor(props: ProductEditorProps) {
  return <ProductEditorSession key={productDraftKey(props.userId, props.shopId, props.productId)} {...props} />;
}

function ProductEditorSession({
  mode,
  shopId,
  userId,
  existingSlugs,
  initialValue,
  productId,
  initialKeyRecords = [],
  shopName = null,
  pdfPreferences = DEFAULT_PDF_PREVIEW_PREFERENCES,
  saveProduct,
  deleteAsset = deleteShopAsset,
}: ProductEditorProps) {
  const router = useRouter();
  const workspaceDialog = useWorkspaceDialog();
  const draftStore = useProductDrafts();
  const draftKey = productDraftKey(userId, shopId, productId);
  const [restoredDraft] = useState(() => draftStore?.read(draftKey));
  const draftActive = useRef(true);
  const [value, setValue] = useState(restoredDraft?.value ?? initialValue);
  // Field errors stay quiet until the seller presses the button; from then on
  // they follow the fields live, so a message never outlives its mistake.
  const [showErrors, setShowErrors] = useState(false);
  // Bumped on every refused submit, to carry the seller to the field at fault.
  const [refusedAt, setRefusedAt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [previewsUploading, setPreviewsUploading] = useState(false);
  // Samples are marked in the shop's own style, the same one PDF pages get.
  const previewProtection = useMemo<ProtectedPreviewOptions>(() => ({
    blurStrength: pdfPreferences.blurStrength,
    watermarkOpacity: pdfPreferences.watermarkOpacity,
    watermarkText: watermarkLabel(pdfPreferences, shopName),
  }), [pdfPreferences, shopName]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(Boolean(restoredDraft));
  const [keyRecords, setKeyRecords] = useState(restoredDraft?.keyRecords ?? initialKeyRecords);
  // A blank new product starts at the PDF step; a restored draft, or a value
  // that already carries content, goes straight to the form.
  const [intakeOpen, setIntakeOpen] = useState(
    mode === "create" && !restoredDraft && isBlankProductValue(initialValue),
  );
  // What the agent flagged about the draft it just wrote into these fields.
  const [intakeSummary, setIntakeSummary] = useState<PdfIntakeSummary | null>(null);
  // An empty price is the one blank that costs money if it ships unnoticed, so
  // once the agent has filled the form the field is marked red until a price is
  // there — whether the model found none or the seller cleared it again.
  const [agentFilledForm, setAgentFilledForm] = useState(false);
  const [agentFoundPrice, setAgentFoundPrice] = useState(false);
  // The clean page renders behind the preview images, kept for as long as the
  // seller is in the form so any one page can be blurred or marked afterwards.
  // They are held in memory only: a reopened draft has the images, not these.
  const [pageSources, setPageSources] = useState<PdfPageSource[]>([]);
  const [protectionOptions, setProtectionOptions] = useState<ProtectedPreviewOptions | null>(null);
  const persistedValue = useRef(restoredDraft?.baseline ?? initialValue);
  const draftStorageKey = `framelink-product-draft-assets:${userId}`;

  const currentErrors = useMemo(() => validateProductEditor(value), [value]);
  const errors = showErrors ? currentErrors : NO_FIELD_ERRORS;
  // The button stays pressable while the form is still wrong, because pressing
  // it is how the seller finds out what is wrong. It locks only while an upload
  // or the save itself is in flight, where a second press would do damage.
  const busy = fileUploading || imagesUploading || previewsUploading || saving;

  useEffect(() => {
    if (!refusedAt) return;
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    field?.focus({ preventScroll: true });
    field?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [refusedAt]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty && !fileUploading && !imagesUploading && !previewsUploading) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, fileUploading, imagesUploading, previewsUploading]);

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
        assets.filter((asset) => !draftStore?.assets(userId).some((retained) => retained.destination === asset.destination && retained.path === asset.path))
          .map((asset) => deleteAsset(asset.destination, asset.path)),
      );
    } catch {
      // Ignore a corrupt local draft record; it never contains file contents.
    }
  }, [deleteAsset, draftStorageKey, draftStore, userId]);

  useEffect(() => {
    if (!draftActive.current) return;
    if (dirty) draftStore?.save(draftKey, { userId, value, baseline: persistedValue.current, keyRecords });
    else draftStore?.clear(draftKey);
    const assets = draftStore?.assets(userId) ?? findNewProductAssets(persistedValue.current, value);
    if (assets.length) window.localStorage.setItem(draftStorageKey, JSON.stringify(assets));
    else window.localStorage.removeItem(draftStorageKey);
  }, [draftStorageKey, value, dirty, keyRecords, draftStore, draftKey, userId]);

  useEffect(() => {
    const interceptNavigation = (event: MouseEvent) => {
      if (!dirty && !fileUploading && !imagesUploading && !previewsUploading) return;
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
    draftActive.current = true;
    setValue((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  /**
   * Writes every field the agent drafted straight into the form. Nothing is
   * held back behind a second confirmation: each field is editable where it
   * lands, so the seller reviews it by reading the form they are already in.
   */
  function applyIntake({
    draft,
    summary,
    productFile,
    images,
    pages,
    protectionOptions: options,
  }: PdfIntakeResult) {
    const patch: Partial<ProductEditorValue> = { deliveryType: "file", productFile };
    if (draft.name) patch.name = draft.name;
    if (draft.price) {
      patch.price = draft.price;
      patch.comparePrice = draft.comparePrice;
    }
    if (draft.descriptionHtml) patch.descriptionHtml = draft.descriptionHtml;
    if (draft.highlights.length) patch.highlights = draft.highlights;
    if (draft.faq.length) patch.faq = draft.faq;
    if (images.length) patch.images = images;
    update(patch);
    setPageSources(pages);
    setProtectionOptions(options);
    setAgentFilledForm(true);
    setAgentFoundPrice(Boolean(draft.price));
    setIntakeSummary(summary);
    setIntakeOpen(false);
  }

  function clearDraft() {
    draftActive.current = false;
    draftStore?.clear(draftKey);
    const retainedAssets = draftStore?.assets(userId) ?? [];
    if (retainedAssets.length) window.localStorage.setItem(draftStorageKey, JSON.stringify(retainedAssets));
    else window.localStorage.removeItem(draftStorageKey);
  }

  async function cleanupDraftAssets() {
    await Promise.allSettled(
      findNewProductAssets(persistedValue.current, value).map((asset) =>
        deleteAsset(asset.destination, asset.path),
      ),
    );
    clearDraft();
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
      (dirty || fileUploading || imagesUploading || previewsUploading) &&
      !window.confirm("มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?")
    ) {
      return;
    }
    await cleanupDraftAssets();
    router.push("/dashboard/products");
  }

  useEffect(() => {
    if (!workspaceDialog) return;
    workspaceDialog.current = () => {
      if (!saving && !fileUploading && !imagesUploading && !previewsUploading) void leaveEditor();
    };
    return () => { workspaceDialog.current = null; };
  });

  const priceMissing = agentFilledForm && !value.price.trim();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validateProductEditor(value);
    setShowErrors(true);
    if (Object.keys(nextErrors).length > 0) {
      setRefusedAt((attempt) => attempt + 1);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSavedMessage(null);
    const sanitizedHtml = DOMPurify.sanitize(value.descriptionHtml, {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "src"],
    });
    // A file product delivers its file; a course may carry a companion PDF,
    // and a file left over from switching a file product to a course is dropped.
    const deliveredFile =
      value.deliveryType === "file" ? value.productFile
      : value.deliveryType === "course" && value.productFile?.mimeType === "application/pdf" ? value.productFile
      : null;
    const previews = value.previews ?? [];
    const payload = {
      shop_id: shopId,
      name: value.name.trim(),
      description: visibleText(sanitizedHtml),
      description_html: sanitizedHtml,
      category: productCategory(value.deliveryType),
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
      preview_images: previews,
      delivery_type: value.deliveryType,
      affiliate_rate_bp: affiliateRateBasisPoints(value.affiliateRate),
      course_access_days: value.deliveryType === "course" && value.courseAccessDays ? Number(value.courseAccessDays) : null,
      file_path: deliveredFile?.path ?? null,
      file_name: deliveredFile?.fileName ?? null,
      file_size: deliveredFile?.size ?? null,
      file_mime_type: deliveredFile?.mimeType ?? null,
      file_page_count: deliveredFile?.pageCount ?? null,
      published: mode === "create" && value.deliveryType === "course" ? false : value.published,
      updated_at: new Date().toISOString(),
    };

    if (mode === "create") {
      let createdId: string | undefined;
      const slug = uniqueProductSlug(
        slugifyProductName(value.name),
        existingSlugs,
      );
      try {
        if (saveProduct) {
          await writeProductRow(
            {
              ...payload,
              slug,
              product_keys:
                value.deliveryType === "key"
                  ? parseProductKeys(value.keyInput).keys
                  : [],
            },
            previews.length > 0,
            (row) => saveProduct(row),
          );
        } else {
          const supabase = createClient();
          const createdProduct = await writeProductRow(
            { ...payload, slug },
            previews.length > 0,
            async (row) => {
              const { data, error } = await supabase
                .from("products")
                .insert(row)
                .select("id")
                .single();
              if (error) throw error;
              return data;
            },
          );
          createdId = createdProduct.id;
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
      await invalidatePublicCatalog();
      setDirty(false);
      clearDraft();
      router.push(value.deliveryType === "course" && createdId ? `/dashboard/products/${createdId}/lessons` : "/dashboard/products");
      router.refresh();
      return;
    }

    let insertedKeyCount = 0;
    let refreshed = true;
    try {
      if (saveProduct) {
        insertedKeyCount =
          value.deliveryType === "key"
            ? parseProductKeys(value.keyInput).keys.length
            : 0;
        await writeProductRow(
          {
            ...payload,
            product_keys:
              value.deliveryType === "key"
                ? parseProductKeys(value.keyInput).keys
                : [],
          },
          previews.length > 0,
          (row) => saveProduct(row),
        );
      } else {
        const supabase = createClient();
        await writeProductRow(payload, previews.length > 0, async (row) => {
          const { error } = await supabase
            .from("products")
            .update(row)
            .eq("id", productId!)
            .eq("shop_id", shopId);
          if (error) throw error;
        });
        refreshed = await invalidatePublicCatalog();
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
    clearDraft();
    setDirty(false);
    setSaving(false);
    if (saveProduct) refreshed = await invalidatePublicCatalog();
    setSavedMessage(refreshed ? "บันทึกสินค้าเรียบร้อยแล้ว" : CATALOG_REFRESH_WARNING);
    if (workspaceDialog && refreshed) router.push("/dashboard/products");
    router.refresh();
  }

  const heading = (
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
  );

  if (intakeOpen) {
    return (
      <div className="product-editor">
        {heading}
        <ProductPdfIntake
          userId={userId}
          shopName={shopName}
          preferences={pdfPreferences}
          onApply={applyIntake}
          onSkip={() => setIntakeOpen(false)}
        />
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="product-editor">
      {heading}

      {intakeSummary && (
        <IntakeSummaryCard
          summary={intakeSummary}
          onDismiss={() => setIntakeSummary(null)}
        />
      )}

      <section className="product-section">
        <h2 className="product-section-title" id="product-type-title">ประเภทสินค้า</h2>
        {value.deliveryType === "key" ? (
          <div className="mt-4 rounded-2xl border border-line bg-paper-dim p-4">
            <p className="text-sm font-semibold text-ink">File · Product Key</p>
            <p className="mt-1 text-xs leading-5 text-muted">สินค้านี้ส่ง Product Key ให้ลูกค้า จัดการ Key และจำนวนคงเหลือได้ด้านล่าง</p>
          </div>
        ) : (
          <fieldset aria-labelledby="product-type-title">
            <p className="product-help">เลือกสิ่งที่ลูกค้าจะได้รับหลังชำระเงิน</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {PRODUCT_TYPES.map((option) => (
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
                      onChange={() => update({ deliveryType: option.value, category: productCategory(option.value) })}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{option.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted">{option.description}</span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </section>

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
                  min={MIN_PRICE_BAHT}
                  step="0.01"
                  onChange={(event) => update({ price: event.target.value })}
                  placeholder="199"
                  className="field-input pl-9"
                  aria-invalid={Boolean(errors.price) || priceMissing}
                />
              </span>
              {errors.price && <span className="field-error">{errors.price}</span>}
              {!errors.price && priceMissing && (
                <span className="field-error">
                  {agentFoundPrice
                    ? "ยังไม่ได้กรอกราคา กรอกก่อนบันทึก"
                    : "AI หาราคาในไฟล์ไม่เจอ กรุณากรอกราคาเอง"}
                </span>
              )}
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

          <AffiliateRateField
            rate={value.affiliateRate ?? ""}
            price={value.price}
            error={errors.affiliateRate}
            onChange={(affiliateRate) => update({ affiliateRate })}
          />

          <div>
            <p className="field-label mb-2">รายละเอียด</p>
            <RichTextEditor
              value={value.descriptionHtml}
              onChange={(descriptionHtml) => update({ descriptionHtml })}
            />
          </div>
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
      ) : value.deliveryType === "key" ? (
        <ProductKeyInventory
          value={value.keyInput}
          onChange={(keyInput) => update({ keyInput })}
          summary={value.keyInventory}
          records={keyRecords}
          error={errors.productKeys}
          onStatusChange={mode === "edit" ? changeKeyStatus : undefined}
        />
      ) : (
        <>
        <section className="product-section">
          <h2 className="product-section-title">สิทธิ์เข้าเรียน</h2>
          <p className="product-help">ชำระครั้งเดียว เริ่มนับจากเวลาชำระสำเร็จ การแก้ไขระยะเวลามีผลเฉพาะออเดอร์ใหม่</p>
          <label className="field-label mt-4">ระยะเวลาเข้าเรียน
            <select className="field-input mt-2" value={value.courseAccessDays ? "days" : "lifetime"} onChange={e => update({courseAccessDays:e.target.value === "days" ? "365" : ""})}>
              <option value="lifetime">ตลอดชีพ</option><option value="days">กำหนดจำนวนวัน</option>
            </select>
          </label>
          {value.courseAccessDays && <label className="field-label mt-4">จำนวนวัน<input type="number" min="1" max="36500" step="1" className="field-input mt-2" value={value.courseAccessDays} onChange={e => update({courseAccessDays:e.target.value})}/></label>}
          {errors.courseAccessDays && <p role="alert" className="field-error">{errors.courseAccessDays}</p>}
          {mode === "create" ? <p className="mt-4 text-sm text-muted">คอร์สจะถูกสร้างเป็นแบบร่าง จากนั้นเพิ่มบทเรียนและเผยแพร่เมื่อพร้อม</p> : <Link className="secondary-button group mt-5 inline-flex items-center gap-1.5" href={`/dashboard/products/${productId}/lessons`}>จัดการบทเรียน<ArrowRightIcon className="size-4 transition-transform duration-[200ms] ease-out group-hover:translate-x-0.5" /></Link>}
        </section>
        <ProductFileUploader
          coursePdf
          userId={userId}
          value={value.productFile?.mimeType === "application/pdf" ? value.productFile : null}
          onChange={(productFile) => update({ productFile })}
          onUploadingChange={setFileUploading}
        />
        </>
      )}

      <ProductImageUploader
        userId={userId}
        value={value.images}
        onChange={(images) => update({ images })}
        onUploadingChange={setImagesUploading}
        pages={pageSources}
        protectionOptions={protectionOptions ?? undefined}
        onPagesChange={setPageSources}
        deleteAsset={deleteAsset}
      />

      <HighlightFields
        value={value.highlights}
        onChange={(highlights) => update({ highlights })}
      />
      <ProductPreviewUploader
        userId={userId}
        value={value.previews ?? []}
        onChange={(previews) => update({ previews })}
        onUploadingChange={setPreviewsUploading}
        protectionOptions={previewProtection}
        deleteAsset={deleteAsset}
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
        <button type="submit" disabled={busy} className="primary-button">
          {saving
            ? "กำลังบันทึก..."
            : mode === "create"
              ? value.deliveryType === "course" ? "สร้างคอร์สและเพิ่มบทเรียน" : "สร้างสินค้า"
              : "บันทึกการเปลี่ยนแปลง"}
        </button>
      </div>
    </form>
  );
}

/**
 * The draft is already in the fields, so this says only what reading the form
 * cannot: what the agent could not work out, what the reading cost, and whether
 * the words were recognized from images and so may be misspelled.
 */
function IntakeSummaryCard({
  summary,
  onDismiss,
}: {
  summary: PdfIntakeSummary;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        summary.scanned ? "border-amber-200 bg-amber-50" : "border-line bg-paper-dim"
      }`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${summary.scanned ? "text-amber-900" : "text-ink"}`}>
            AI กรอกข้อมูลจาก {summary.fileName} ให้แล้ว
          </p>
          <p
            className={`mt-1 text-xs leading-5 ${summary.scanned ? "text-amber-800" : "text-muted"}`}
          >
            ตรวจและแก้ได้ทุกช่องก่อนบันทึก อ่าน {summary.textPagesRead} หน้าแรกของไฟล์
            {summary.costMicros !== null && ` · ค่าใช้จ่ายครั้งนี้ ${formatUsd(summary.costMicros)}`}
          </p>
          {summary.scanned && (
            <p className="mt-2 text-xs leading-5 text-amber-800">
              ไฟล์นี้ไม่มีชั้นข้อความ (น่าจะเป็นไฟล์สแกน) ระบบอ่านตัวอักษรจากรูป
              การอ่านแบบนี้สะกดคำพลาดได้
              <strong className="font-semibold"> กรุณาตรวจราคาและชื่อสินค้าให้ละเอียด</strong>
            </p>
          )}
          {summary.notes && (
            <p
              className={`mt-2 text-xs leading-5 ${summary.scanned ? "text-amber-800" : "text-ink-soft"}`}
            >
              {summary.notes}
            </p>
          )}
        </div>
        <button type="button" onClick={onDismiss} className="small-button shrink-0">
          ปิด
        </button>
      </div>
    </div>
  );
}

/** Referral commission for this product, a switch with the % beside the price it applies to. */
function AffiliateRateField({ rate, price, error, onChange }: { rate: string; price: string; error?: string; onChange: (rate: string) => void }) {
  const [enabled, setEnabled] = useState(rate !== "");
  const baht = Number(price);
  const earns = rate && baht > 0 && !error ? Math.floor(baht * 100 * Math.round(Number(rate) * 100) / 10000) / 100 : null;
  function toggle() {
    setEnabled(!enabled);
    onChange(enabled ? "" : rate || "10");
  }
  return (
    <div className="rounded-2xl border border-line bg-paper-dim p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p id="affiliate-rate-title" className="text-sm font-semibold text-ink">ลิงก์แนะนำ</p>
          <p className="mt-1 text-xs leading-5 text-muted">ให้คนที่ซื้อแล้วชวนเพื่อนมาซื้อ ผู้แนะนำได้ค่าคอมตาม % นี้ หักจากยอดโอนให้ร้าน ผู้ซื้อจ่ายราคาเท่าเดิม</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="affiliate-rate-title"
          onClick={toggle}
          className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${enabled ? "bg-accent" : "bg-line"}`}
        >
          <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5.5" : "translate-x-0.5"}`} />
        </button>
      </div>
      {enabled && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            ค่าคอม
            <span className="relative block w-24">
              <input
                type="number"
                min="1"
                max="50"
                step="0.5"
                inputMode="decimal"
                className="field-input pr-8"
                value={rate}
                onChange={(event) => onChange(event.target.value)}
                onBlur={() => { if (rate === "") { setEnabled(false); } }}
                aria-invalid={Boolean(error)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">%</span>
            </span>
          </label>
          {earns !== null && (
            <p className="text-sm text-muted">
              ผู้แนะนำได้ <span className="font-semibold text-ink">฿{earns.toLocaleString("th-TH")}</span> ต่อการซื้อ
            </p>
          )}
          <p className="w-full text-xs text-muted">ตั้งได้ 1–50% · การแก้ % มีผลเฉพาะออเดอร์ใหม่</p>
        </div>
      )}
      {error && <p role="alert" className="field-error mt-2">{error}</p>}
    </div>
  );
}
