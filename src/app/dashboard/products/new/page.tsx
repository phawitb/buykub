import { redirect } from "next/navigation";
import { ProductEditor } from "@/features/products/components/ProductEditor";
import type { ProductEditorValue } from "@/features/products/model";
import {
  DEFAULT_PDF_PREVIEW_PREFERENCES,
  normalizePdfPreviewPreferences,
} from "@/features/products/pdf/preferences";
import { getSellerContext } from "@/lib/supabase/seller-context";

const initialValue: ProductEditorValue = {
  deliveryType: "file",
  courseAccessDays: "",
  affiliateRate: "",
  keyInput: "",
  keyInventory: { available: 0, assigned: 0, disabled: 0 },
  name: "",
  price: "",
  comparePrice: "",
  category: "OTHER",
  descriptionHtml: "",
  productFile: null,
  images: [],
  highlights: [],
  faq: [],
  published: true,
};

export default async function NewProductPage() {
  const { supabase, user, shop } = await getSellerContext();

  if (!shop) redirect("/dashboard/products?create=1");

  const [{ data: products }, preferences] = await Promise.all([
    supabase.from("products").select("slug").eq("shop_id", shop.id),
    supabase
      .from("seller_pdf_preferences")
      .select("preview_page_count, watermark_enabled, watermark_text, blur_strength, watermark_opacity")
      .eq("user_id", user!.id)
      .maybeSingle(),
  ]);

  return (
    <ProductEditor
      mode="create"
      shopId={shop.id}
      userId={user!.id}
      shopName={shop.name}
      // A seller who has never opened the setting, or a table that predates the
      // migration, both fall back to the documented defaults.
      pdfPreferences={
        preferences.error || !preferences.data
          ? DEFAULT_PDF_PREVIEW_PREFERENCES
          : normalizePdfPreviewPreferences(preferences.data)
      }
      existingSlugs={(products ?? [])
        .map((product) => product.slug)
        .filter((slug): slug is string => Boolean(slug))}
      initialValue={initialValue}
    />
  );
}
