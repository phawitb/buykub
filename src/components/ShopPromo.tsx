import { getPublicProducts, getPublicShop } from "@/lib/storefront/catalog";
import { discountPercent } from "@/features/products/format";
import { ShopPromoPopup, type ShopPromoData } from "./ShopPromoPopup";

/** The shop the home page advertises, and the line that sells it. */
export const PROMO_SHOP_SLUG = "mysheet";
const PROMO_HEADLINE = "คอร์สติวสอบตำรวจ สายอำนวยการ และ นสต.";

/**
 * Loads the advertised shop's live catalogue so the ad never shows a price or
 * cover the shop no longer has. Any failure hides the ad rather than the page.
 */
export async function loadShopPromo(slug: string): Promise<ShopPromoData | null> {
  try {
    const shop = await getPublicShop(slug);
    if (!shop) return null;
    const products = (await getPublicProducts(shop.id)) ?? [];
    if (!products.length) return null;
    const cheapest = products.reduce((a, b) => (b.price_cents < a.price_cents ? b : a));
    const covers = products
      .map((product) => {
        const imagesV2 = Array.isArray(product.images_v2)
          ? (product.images_v2 as Array<{ publicUrl?: string }>)
          : [];
        return imagesV2[0]?.publicUrl ?? product.images?.[0] ?? null;
      })
      .filter((url): url is string => Boolean(url))
      .slice(0, 3);
    const discounts = products
      .map((product) => discountPercent(product.price_cents, product.compare_price_cents))
      .filter((value): value is number => value !== null);
    return {
      slug: shop.slug,
      name: shop.name,
      headline: slug === PROMO_SHOP_SLUG ? PROMO_HEADLINE : shop.name,
      bio: shop.bio,
      avatarUrl: shop.avatar_url,
      covers,
      productCount: products.length,
      fromCents: cheapest.price_cents,
      fromCompareCents: cheapest.compare_price_cents,
      maxDiscount: discounts.length ? Math.max(...discounts) : null,
    };
  } catch {
    return null;
  }
}

export async function ShopPromo({ slug = PROMO_SHOP_SLUG }: { slug?: string }) {
  const promo = await loadShopPromo(slug);
  return promo ? <ShopPromoPopup promo={promo} /> : null;
}
