import Link from "next/link";
import { ProductCard } from "@/features/storefront/ProductCard";
import { ProductGrid } from "@/features/storefront/ProductGrid";
import { ShopShell } from "@/features/storefront/ShopShell";
import { formatTHB } from "@/features/products/format";
import { createPublicClient } from "@/lib/supabase/public";
import { BookButton } from "./BookButton";
import { ShareButton } from "./ShareButton";

export default async function ShopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createPublicClient();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, slug, name, bio, avatar_url, cover_url, accent_color")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (!shop) return <NotFoundCard slug={slug} />;

  const [{ data: products }, { data: services }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, slug, name, category, price_cents, compare_price_cents, images, images_v2, delivery_type, created_at",
      )
      .eq("shop_id", shop.id)
      .eq("published", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("services")
      .select("id, name, description, price_cents, duration_minutes, availability")
      .eq("shop_id", shop.id)
      .eq("published", true)
      .order("created_at", { ascending: true }),
  ]);

  await supabase.from("shop_views").insert({ shop_id: shop.id });

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
      deliveryType: product.delivery_type === "key" ? ("key" as const) : ("file" as const),
      availableStock:
        product.delivery_type === "key"
          ? stockByProduct.get(product.id) ?? 0
          : undefined,
    };
  });

  return (
    <ShopShell>
        <div
          className="relative aspect-[16/5] w-full bg-paper-dim"
          style={{
            backgroundColor: shop.cover_url
              ? undefined
              : shop.accent_color || "var(--color-paper-dim)",
          }}
        >
          {shop.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shop.cover_url}
              alt={`${shop.name} cover`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.24),transparent_35%)]" />
          )}
        </div>

        <div className="px-[22px] pb-14">
          <div className="-mt-10 flex h-20 items-end justify-between">
            <div className="relative flex size-20 items-center justify-center overflow-hidden rounded-full bg-ink text-2xl font-bold text-paper">
              {shop.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shop.avatar_url}
                  alt={shop.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                shop.name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="mb-[-8px]">
              <ShareButton />
            </div>
          </div>

          <h1 className="mt-3 text-2xl font-bold text-ink">{shop.name}</h1>
          {shop.bio && (
            <p className="mt-1.5 max-w-lg text-sm leading-6 text-muted">
              {shop.bio}
            </p>
          )}

          <section className="mt-8 border-t border-line pt-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-[0.2em] text-muted">
                สินค้าดิจิทัล
              </h2>
              <span className="text-xs tabular-nums text-muted">
                {String(productCards.length).padStart(2, "0")}
              </span>
            </div>

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
          </section>

          {(services?.length ?? 0) > 0 && (
            <section className="mt-10 border-t border-line pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xs font-semibold tracking-[0.2em] text-muted">
                  บริการจอง
                </h2>
                <span className="text-xs tabular-nums text-muted">
                  {String(services!.length).padStart(2, "0")}
                </span>
              </div>
              <div className="space-y-3">
                {services!.map((service) => (
                  <article
                    key={service.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-line p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted">
                        {service.duration_minutes} นาที
                      </p>
                      <h3 className="mt-1 font-semibold text-ink">
                        {service.name}
                      </h3>
                      <p className="mt-2 text-sm font-bold text-ink">
                        {formatTHB(service.price_cents)}
                      </p>
                    </div>
                    <BookButton
                      serviceId={service.id}
                      shopId={shop.id}
                      serviceName={service.name}
                      priceCents={service.price_cents}
                      durationMinutes={service.duration_minutes}
                      availability={service.availability as {
                        days?: number[];
                        start?: string;
                        end?: string;
                        advance_days?: number;
                      }}
                    />
                  </article>
                ))}
              </div>
            </section>
          )}

          <p className="mt-12 text-center text-xs text-muted">
            สร้างด้วย <span className="font-semibold text-ink">Framelink</span>{" "}
            —{" "}
            <Link href="/login" className="underline underline-offset-2">
              เปิดร้านฟรี
            </Link>
          </p>
        </div>
    </ShopShell>
  );
}

function NotFoundCard({ slug }: { slug: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f7] px-5">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-paper p-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-paper-dim text-2xl text-muted">
          ◇
        </div>
        <h1 className="mt-5 text-xl font-bold text-ink">ไม่พบร้านนี้</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          ร้าน “{slug}” อาจยังไม่ได้เปิดหรือเปลี่ยนชื่อไปแล้ว
        </p>
        <Link href="/" className="primary-button mt-6 inline-block">
          กลับหน้าแรก
        </Link>
      </div>
    </main>
  );
}
