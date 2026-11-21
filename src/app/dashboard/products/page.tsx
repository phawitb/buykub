import { redirect } from "next/navigation";
import { getSellerContext } from "@/lib/supabase/seller-context";
import { normalizePreviewImages } from "@/features/products/previews";
import { isMissingColumnError } from "@/lib/supabase/missing-column";
import { MyShop } from "./MyShop";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ slug?: string; create?: string }> }) {
  const { slug: desiredSlug, create } = await searchParams;
  const { supabase, user, shop: sellerShop } = await getSellerContext();
  if (!sellerShop && create !== "1" && !desiredSlug) redirect("/learn");
  if (!sellerShop) return <MyShop key="new" userId={user.id} initial={null} products={[]} desiredSlug={desiredSlug} />;
  const { data: shop, error: shopError } = await supabase.from("shops")
    .select("id, slug, name, bio, avatar_url, cover_url, accent_color, published")
    .eq("id", sellerShop.id).eq("owner_id", user.id).single();
  if (shopError) throw shopError;

  const listProducts = (arranged: boolean) => {
    const query = supabase
      .from("products")
      .select(
        "id, shop_id, name, slug, description, price_cents, compare_price_cents, category, published, delivery_type, images, images_v2, file_path",
      )
      .eq("shop_id", shop.id);
    // Same order as the storefront: the seller's arrangement, then never-arranged products oldest first.
    return (arranged ? query.order("position", { ascending: true, nullsFirst: false }) : query)
      .order("created_at", { ascending: true });
  };
  const arranged = await listProducts(true);
  const { data: products, error: productsError } = isMissingColumnError(arranged.error, "position")
    ? await listProducts(false)
    : arranged;
  if (productsError) throw productsError;

  const stockEntries = await Promise.all((products ?? []).filter((product) => product.delivery_type === "key").map(async (product) => {
    const { data } = await supabase.rpc("product_available_key_count", { p_product_id: product.id });
    return [product.id, Number(data ?? 0)] as const;
  }));
  const stockByProduct = new Map(stockEntries);
  // Sample images are deleted with their product; a database without the column has none.
  const previewRows = products?.length
    ? await supabase.from("products").select("id, preview_images").eq("shop_id", shop.id)
    : { data: [], error: null };
  if (previewRows.error && !isMissingColumnError(previewRows.error, "preview_images")) throw previewRows.error;
  const previewsByProduct = new Map(
    (previewRows.data ?? []).map((row) => [row.id as string, normalizePreviewImages(row.preview_images)]),
  );
  const listItems = (products ?? []).map((product) => {
    const imagesV2 = Array.isArray(product.images_v2)
      ? (product.images_v2 as Array<{ path?: string; publicUrl?: string }>)
      : [];
    return {
      id: product.id,
      shop_id: product.shop_id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price_cents: product.price_cents,
      compare_price_cents: product.compare_price_cents,
      category: product.category,
      published: product.published,
      delivery_type: product.delivery_type,
      availableStock: product.delivery_type === "key" ? stockByProduct.get(product.id) ?? 0 : undefined,
      thumbnailUrl: imagesV2[0]?.publicUrl ?? product.images?.[0] ?? null,
      assets: [
        ...(product.file_path
          ? [{ destination: "product-file" as const, path: product.file_path }]
          : []),
        ...imagesV2
          .filter(
            (image): image is { path: string; publicUrl?: string } =>
              Boolean(image.path),
          )
          .map((image) => ({
            destination: "product-image" as const,
            path: image.path,
          })),
        ...(previewsByProduct.get(product.id) ?? []).map((preview) => ({
          destination: "product-image" as const,
          path: preview.path,
        })),
      ],
    };
  });

  return <MyShop key={shop.id} userId={user.id} initial={shop} products={listItems} />;
}
