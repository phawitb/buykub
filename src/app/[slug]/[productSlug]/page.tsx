import type { Metadata } from "next";
import DOMPurify from "isomorphic-dompurify";
import Link from "next/link";
import { notFound } from "next/navigation";
import { discountPercent, formatTHB } from "@/features/products/format";
import type { ProductFAQ, ProductImage } from "@/features/products/model";
import { ProductViewTracker } from "@/features/analytics/ProductViewTracker";
import { ProductGallery } from "@/features/storefront/ProductGallery";
import { ProductDetailShell } from "@/features/storefront/ProductDetailShell";
import { BRAND_NAME } from "@/lib/brand";
import { createPublicClient } from "@/lib/supabase/public";
import { ProductPurchase } from "./ProductPurchase";

type Params = Promise<{ slug: string; productSlug: string }>;

async function loadProduct(params: Params) {
  const { slug, productSlug } = await params;
  const supabase = createPublicClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("id, slug, name, avatar_url, published")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!shop) return null;

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, shop_id, slug, name, description, description_html, category, price_cents, compare_price_cents, highlights, faq, images, images_v2, delivery_type, published",
    )
    .eq("shop_id", shop.id)
    .eq("slug", productSlug)
    .eq("published", true)
    .maybeSingle();
  if (!product) return null;

  const { data: availableStock } =
    product.delivery_type === "key"
      ? await supabase.rpc("product_available_key_count", {
          p_product_id: product.id,
        })
      : { data: null };

  return {
    shop,
    product,
    availableStock:
      product.delivery_type === "key" ? Number(availableStock ?? 0) : undefined,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const result = await loadProduct(params);
  if (!result) return { title: `ไม่พบสินค้า — ${BRAND_NAME}` };
  return {
    title: `${result.product.name} — ${result.shop.name}`,
    description:
      result.product.description?.slice(0, 155) ||
      `ซื้อ ${result.product.name} จาก ${result.shop.name}`,
  };
}

export default async function ProductDetailPage({ params }: { params: Params }) {
  const result = await loadProduct(params);
  if (!result) notFound();
  const { shop, product, availableStock } = result;

  const imagesV2 = Array.isArray(product.images_v2)
    ? (product.images_v2 as ProductImage[])
    : [];
  const legacyImages = (product.images ?? []).map(
    (url: string, index: number): ProductImage => ({
      id: `legacy-${index}`,
      path: url,
      publicUrl: url,
      alt: `${product.name} ${index + 1}`,
    }),
  );
  const images = imagesV2.length ? imagesV2 : legacyImages;
  const rawFaq = Array.isArray(product.faq) ? product.faq : [];
  const faq: ProductFAQ[] = rawFaq
    .map(
      (
        item: {
          id?: string;
          question?: string;
          answer?: string;
          q?: string;
          a?: string;
        },
        index: number,
      ) => ({
        id: item.id || `faq-${index}`,
        question: item.question || item.q || "",
        answer: item.answer || item.a || "",
      }),
    )
    .filter((item: ProductFAQ) => item.question && item.answer);
  const safeDescription = DOMPurify.sanitize(
    product.description_html ||
      (product.description ? `<p>${product.description}</p>` : ""),
    {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "src"],
    },
  );
  const discount = discountPercent(
    product.price_cents,
    product.compare_price_cents,
  );

  return (
    <ProductDetailShell>
      <ProductViewTracker productId={product.id} shopId={shop.id} />
      <Link
          href={`/${shop.slug}`}
          className="absolute left-4 top-4 z-10 rounded-full bg-paper/90 px-4 py-2 text-xs font-semibold text-ink shadow-sm backdrop-blur transition hover:bg-paper"
        >
          ‹ {shop.name}
      </Link>

      <ProductGallery images={images} productName={product.name} />

      <div className="px-[22px] pb-14 pt-6">
          <span className="inline-flex rounded-full bg-ink px-3 py-1.5 text-[10px] font-semibold text-paper">
            {product.category}
          </span>
          <h1 className="mt-4 text-2xl font-bold leading-tight text-ink sm:text-3xl">
            {product.name}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-2xl font-bold text-ink">
              {formatTHB(product.price_cents)}
            </span>
            {product.compare_price_cents && (
              <span className="text-sm text-muted line-through">
                {formatTHB(product.compare_price_cents)}
              </span>
            )}
            {discount && (
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                -{discount}%
              </span>
            )}
          </div>

          <div className="mt-5">
            <ProductPurchase
              product={{
                id: product.id,
                shopId: shop.id,
                name: product.name,
                priceCents: product.price_cents,
                deliveryType:
                  product.delivery_type === "key" ? "key" : "file",
                availableStock,
              }}
            />
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted">
              <span>PromptPay · บัตรเครดิต</span>
              <span aria-hidden="true">·</span>
              <span>คืนเงินได้ภายใน 7 วัน</span>
            </div>
          </div>

          {safeDescription && (
            <section className="mt-8 border-t border-line pt-7">
              <p className="text-[11px] font-semibold tracking-[0.22em] text-muted">
                รายละเอียด
              </p>
              <div
                className="product-prose mt-6"
                dangerouslySetInnerHTML={{ __html: safeDescription }}
              />
            </section>
          )}

          {(product.highlights?.length ?? 0) > 0 && (
            <section className="mt-8 border-t border-line pt-7">
              <h2 className="text-xl font-bold text-ink">สิ่งที่คุณจะได้รับ</h2>
              <ul className="mt-4 space-y-3">
                {product.highlights.map((highlight: string) => (
                  <li key={highlight} className="flex gap-3 text-sm text-ink-soft">
                    <span className="text-accent">✓</span>
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {faq.length > 0 && (
            <section className="mt-8 border-t border-line pt-7">
              <h2 className="text-xl font-bold text-ink">
                คำถามที่พบบ่อย (FAQ)
              </h2>
              <div className="mt-4 divide-y divide-line border-y border-line">
                {faq.map((item) => (
                  <details key={item.id} className="group py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink">
                      {item.question}
                      <span className="text-lg text-muted transition group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-sm leading-7 text-muted">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <footer className="mt-10 flex items-center justify-between border-t border-line pt-6">
            <div className="flex items-center gap-3">
              {shop.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shop.avatar_url}
                  alt={shop.name}
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink font-bold text-paper">
                  {shop.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <p className="text-sm font-semibold text-ink">{shop.name}</p>
            </div>
            <Link
              href={`/${shop.slug}`}
              className="text-xs font-semibold text-ink underline underline-offset-4"
            >
              ดูสินค้าทั้งหมด →
            </Link>
          </footer>
      </div>
    </ProductDetailShell>
  );
}
