import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { getPublicProducts } from "@/lib/storefront/catalog";
import { getPublicExamSummary } from "@/lib/storefront/exam-summary";

export type UpsellItem = { id: string; name: string; href: string; priceCents: number; compareCents: number | null; cover: string | null };
export type ClassroomUpsell = { shopName: string; upgrade: UpsellItem | null; items: UpsellItem[] };

/**
 * What a free classroom advertises: the shop's other paid products, the paid
 * drill course with mock sets (the free one's full version) first. Published
 * catalogue data only. Paid classrooms and any failure get no ad.
 */
export async function loadClassroomUpsell(productId: string): Promise<ClassroomUpsell | null> {
  try {
    const client = createPublicClient();
    const { data: product } = await client.from("products").select("shop_id, price_cents").eq("id", productId).maybeSingle();
    if (!product || product.price_cents !== 0) return null;
    const { data: shop } = await client.from("shops").select("slug, name").eq("id", product.shop_id).eq("published", true).maybeSingle();
    if (!shop) return null;
    const products = (await getPublicProducts(product.shop_id)).filter(item => item.id !== productId && item.price_cents > 0);
    const items = products.map(item => {
      const images = Array.isArray(item.images_v2) ? (item.images_v2 as Array<{ publicUrl?: string }>) : [];
      return {
        id: item.id, name: item.name, href: `/${shop.slug}/${item.slug}`,
        priceCents: item.price_cents, compareCents: item.compare_price_cents ?? null,
        cover: images[0]?.publicUrl ?? item.images?.[0] ?? null,
      };
    });
    if (!items.length) return null;
    const summaries = await Promise.all(items.map(item => getPublicExamSummary(item.id).catch(() => null)));
    const upgrade = items.find((_, i) => summaries[i]?.mode === "drill" && summaries[i]!.mocks > 0) ?? null;
    return { shopName: shop.name, upgrade, items: upgrade ? [upgrade, ...items.filter(item => item !== upgrade)] : items };
  } catch {
    return null;
  }
}
