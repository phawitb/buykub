import { notFound, redirect } from "next/navigation";
import { ProductEditor } from "@/features/products/components/ProductEditor";
import type {
  ProductEditorValue,
  ProductFAQ,
  ProductImage,
  ProductKeyRecord,
} from "@/features/products/model";
import {
  DEFAULT_PDF_PREVIEW_PREFERENCES,
  normalizePdfPreviewPreferences,
} from "@/features/products/pdf/preferences";
import { normalizePreviewImages } from "@/features/products/previews";
import { isMissingColumnError } from "@/lib/supabase/missing-column";
import { getSellerContext } from "@/lib/supabase/seller-context";

const PRODUCT_FIELDS =
  "id, name, slug, description, description_html, category, price_cents, compare_price_cents, highlights, faq, images, images_v2, file_url, file_path, file_name, file_size, file_mime_type, delivery_type, course_access_days, published";
const PRODUCT_FIELDS_WITH_PAGES = `${PRODUCT_FIELDS}, file_page_count` as const;

type DatabaseFAQ = {
  id?: string;
  question?: string;
  answer?: string;
  q?: string;
  a?: string;
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user, shop } = await getSellerContext();
  if (!shop) redirect("/dashboard/products");

  const row = () => supabase.from("products").select(PRODUCT_FIELDS).eq("id", id).eq("shop_id", shop.id).maybeSingle();
  const rowWithPages = () => supabase.from("products").select(PRODUCT_FIELDS_WITH_PAGES).eq("id", id).eq("shop_id", shop.id).maybeSingle();

  const [productResult, { data: slugRows }, { data: keyRows }, previewResult, preferences, affiliateResult] = await Promise.all([
    // The page count is newer than some databases this runs against, and the
    // editor has to open whether or not that migration has been applied.
    rowWithPages().then(async (result) => {
      if (!isMissingColumnError(result.error, "file_page_count")) return result;
      const fallback = await row();
      return {
        ...fallback,
        data: fallback.data ? { ...fallback.data, file_page_count: null } : null,
      };
    }),
    supabase.from("products").select("slug").eq("shop_id", shop.id).neq("id", id),
    supabase
      .from("product_keys")
      .select("id, key_value, status, assigned_order_id, created_at")
      .eq("product_id", id)
      .order("created_at", { ascending: false }),
    // Read on its own so a database without the column still opens the editor.
    supabase.from("products").select("preview_images").eq("id", id).eq("shop_id", shop.id).maybeSingle(),
    supabase
      .from("seller_pdf_preferences")
      .select("preview_page_count, watermark_enabled, watermark_text, blur_strength, watermark_opacity")
      .eq("user_id", user.id)
      .maybeSingle(),
    // Read on its own so a database without referral links still opens the editor.
    supabase.from("products").select("affiliate_rate_bp").eq("id", id).eq("shop_id", shop.id).maybeSingle<{ affiliate_rate_bp: number | null }>(),
  ]);
  if (previewResult.error && !isMissingColumnError(previewResult.error, "preview_images")) throw previewResult.error;
  const product = productResult.data;
  if (!product) notFound();

  const imagesV2 = Array.isArray(product.images_v2)
    ? (product.images_v2 as ProductImage[])
    : [];
  const legacyImages = (product.images ?? []).map(
    (publicUrl: string, index: number): ProductImage => ({
      id: `legacy-${index}`,
      path: publicUrl,
      publicUrl,
      alt: `${product.name} ${index + 1}`,
    }),
  );
  const faq = (Array.isArray(product.faq) ? product.faq : []).map(
    (item: DatabaseFAQ, index: number): ProductFAQ => ({
      id: item.id || `legacy-faq-${index}`,
      question: item.question || item.q || "",
      answer: item.answer || item.a || "",
    }),
  );

  const initialValue: ProductEditorValue = {
    deliveryType: product.delivery_type === "course" ? "course" : product.delivery_type === "key" ? "key" : "file",
    courseAccessDays: product.course_access_days == null ? "" : String(product.course_access_days),
    affiliateRate: affiliateResult.data?.affiliate_rate_bp ? String(affiliateResult.data.affiliate_rate_bp / 100) : "",
    keyInput: "",
    keyInventory: {
      available: (keyRows ?? []).filter((row) => row.status === "available").length,
      assigned: (keyRows ?? []).filter((row) => row.status === "assigned").length,
      disabled: (keyRows ?? []).filter((row) => row.status === "disabled").length,
    },
    name: product.name,
    price: String(product.price_cents / 100),
    comparePrice: product.compare_price_cents
      ? String(product.compare_price_cents / 100)
      : "",
    category: product.category,
    descriptionHtml:
      product.description_html ||
      (product.description ? `<p>${product.description}</p>` : ""),
    productFile:
      product.file_path || product.file_url
        ? {
            path: product.file_path || product.file_url,
            fileName: product.file_name || "ไฟล์สินค้าเดิม",
            size: Number(product.file_size ?? 0),
            mimeType: product.file_mime_type || "application/octet-stream",
            pageCount: product.file_page_count ?? null,
          }
        : null,
    images: imagesV2.length ? imagesV2 : legacyImages,
    previews: normalizePreviewImages(previewResult.data?.preview_images),
    highlights: product.highlights ?? [],
    faq,
    published: product.published,
  };

  return (
    <ProductEditor
      mode="edit"
      productId={product.id}
      shopId={shop.id}
      userId={user.id}
      shopName={shop.name}
      pdfPreferences={
        preferences.error || !preferences.data
          ? DEFAULT_PDF_PREVIEW_PREFERENCES
          : normalizePdfPreviewPreferences(preferences.data)
      }
      existingSlugs={(slugRows ?? [])
        .map((row) => row.slug)
        .filter((slug): slug is string => Boolean(slug))}
      initialValue={initialValue}
      initialKeyRecords={(keyRows ?? []).map(
        (row): ProductKeyRecord => ({
          id: row.id,
          keyValue: row.key_value,
          status: row.status as ProductKeyRecord["status"],
          assignedOrderId: row.assigned_order_id,
          createdAt: row.created_at,
        }),
      )}
    />
  );
}
