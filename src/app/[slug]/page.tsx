import { connection } from "next/server";
import { getPublicShop, getPublicProducts } from "@/lib/storefront/catalog";
import { ShopViewTracker } from "@/features/analytics/ShopViewTracker";
import Link from "next/link";
import { ProductCard } from "@/features/storefront/ProductCard";
import { ProductGrid } from "@/features/storefront/ProductGrid";
import { Storefront } from "@/features/storefront/Storefront";
import { ShopShell } from "@/features/storefront/ShopShell";
import { createPublicClient } from "@/lib/supabase/public";
import { ShareButton } from "./ShareButton";
import { DashboardShortcut } from "@/components/DashboardShortcut";
import { BRAND_NAME, shopUrl } from "@/lib/brand";
import type { Metadata } from "next";
import { previewText, shareMetadata } from "@/lib/storefront/share-meta";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  await connection();
  const shop = await getPublicShop(slug);
  if (!shop) return { title: `ไม่พบร้าน — ${BRAND_NAME}` };
  return shareMetadata({
    title: shop.name,
    description: previewText(shop.bio) || `ร้าน ${shop.name} บน ${BRAND_NAME}`,
    url: shopUrl(shop.slug),
    image: shop.cover_url ?? shop.avatar_url,
    siteName: shop.name,
  });
}

export default async function ShopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createPublicClient();

  await connection();
  const shop = await getPublicShop(slug);
  if (!shop) return <NotFoundCard slug={slug} />;
  const products = await getPublicProducts(shop.id);

  const stockEntries = await Promise.all(
    (products ?? [])
      .filter((product) => product.delivery_type === "key")
      .map(async (product) => {
        const { data } = await supabase.rpc("product_available_key_count", {
          p_product_id: product.id,
        });
        return [product.id, Number(data ?? 0)] as const;
      }),
  );
  const stockByProduct = new Map(stockEntries);

  const productCards = (products ?? []).map((product) => {
    const imagesV2 = Array.isArray(product.images_v2)
      ? (product.images_v2 as Array<{ publicUrl?: string }>)
      : [];
    return {
      name: product.name,
      slug: product.slug || `product-${product.id.slice(0, 8)}`,
      category: product.category,
      priceCents: product.price_cents,
      comparePriceCents: product.compare_price_cents,
      thumbnailUrl: imagesV2[0]?.publicUrl ?? product.images?.[0] ?? null,
      deliveryType: product.delivery_type === "course" ? ("course" as const) : product.delivery_type === "key" ? ("key" as const) : ("file" as const),
      availableStock:
        product.delivery_type === "key"
          ? stockByProduct.get(product.id) ?? 0
          : undefined,
    };
  });

  return (
    <ShopShell>
        <ShopViewTracker shopId={shop.id} />
        <Storefront shop={shop} headerActions={<div className="flex items-center gap-2"><DashboardShortcut /><ShareButton url={shopUrl(shop.slug)} title={shop.name} /></div>} productCount={productCards.length}>
            {productCards.length ? (
              <ProductGrid>
                {productCards.map((product) => (
                  <div key={product.slug} role="listitem">
                    <ProductCard
                      shopSlug={shop.slug}
                      product={product}
                    />
                  </div>
                ))}
              </ProductGrid>
            ) : (
              <div className="rounded-2xl border border-dashed border-line py-12 text-center">
                <p className="text-sm font-semibold text-ink">
                  ร้านนี้ยังไม่มีสินค้า
                </p>
                <p className="mt-1 text-xs text-muted">กลับมาเช็กใหม่เร็ว ๆ นี้</p>
              </div>
            )}
        </Storefront>
    </ShopShell>
  );
}

function NotFoundCard({ slug }: { slug: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f7] px-5">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-paper p-10 text-center shadow-lift-1">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-paper-dim text-2xl text-muted">
          ◇
        </div>
        <h1 className="mt-5 text-xl font-bold text-ink">ไม่พบร้านนี้</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          ร้าน “{slug}” อาจยังไม่ได้เปิดหรือเปลี่ยนชื่อไปแล้ว
        </p>
        <Link href="/" className="primary-button mt-6">
          กลับหน้าแรก
        </Link>
      </div>
    </main>
  );
}
