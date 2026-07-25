import { notFound, redirect } from "next/navigation";
import { ProductEditor } from "@/features/products/components/ProductEditor";
import type {
  ProductEditorValue,
  ProductFAQ,
  ProductImage,
} from "@/features/products/model";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!shop) redirect("/dashboard/settings");

  const [{ data: product }, { data: slugRows }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, slug, description, description_html, category, price_cents, compare_price_cents, highlights, faq, images, images_v2, file_url, file_path, file_name, file_size, file_mime_type, published",
      )
      .eq("id", id)
      .eq("shop_id", shop.id)
      .maybeSingle(),
    supabase.from("products").select("slug").eq("shop_id", shop.id).neq("id", id),
  ]);
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
          }
        : null,
    images: imagesV2.length ? imagesV2 : legacyImages,
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
      existingSlugs={(slugRows ?? [])
        .map((row) => row.slug)
        .filter((slug): slug is string => Boolean(slug))}
      initialValue={initialValue}
    />
  );
}
