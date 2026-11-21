import { productCategoryLabel } from "@/features/products/category";
import { cache } from "react";
import { connection } from "next/server";
import { getPublicShop, getPublicProduct } from "@/lib/storefront/catalog";
import type { Metadata } from "next";
import DOMPurify from "isomorphic-dompurify";
import Link from "next/link";
import { DashboardShortcut } from "@/components/DashboardShortcut";
import { notFound } from "next/navigation";
import { discountPercent, formatTHB } from "@/features/products/format";
import type { ProductFAQ, ProductImage } from "@/features/products/model";
import { ProductViewTracker } from "@/features/analytics/ProductViewTracker";
import { ProductGallery } from "@/features/storefront/ProductGallery";
import { ProductDetailShell } from "@/features/storefront/ProductDetailShell";
import { BRAND_NAME, productUrl } from "@/lib/brand";
import { ShareButton } from "../ShareButton";
import { createPublicClient } from "@/lib/supabase/public";
import { ProductPurchase } from "./ProductPurchase";
import { getPublicExamSummary } from "@/lib/storefront/exam-summary";
import { getPublicPreviewImages } from "@/lib/storefront/previews";
import { ProductPreviewGallery } from "@/features/storefront/ProductPreviewGallery";
import { ExamCourseOverview } from "@/features/storefront/ExamCourseOverview";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";

type Params = Promise<{ slug: string; productSlug: string }>;

const loadProduct = cache(async (slug: string, productSlug: string) => {
  await connection();
  const shop = await getPublicShop(slug);
  if (!shop) return null;
  const product = await getPublicProduct(shop.id, productSlug);
  if (!product) return null;
  const supabase = createPublicClient();

  const { data: availableStock } =
    product.delivery_type === "key"
      ? await supabase.rpc("product_available_key_count", {
          p_product_id: product.id,
        })
      : { data: null };

  const [examSummary, previews] = await Promise.all([
    product.delivery_type === "course" ? getPublicExamSummary(product.id) : null,
    getPublicPreviewImages(product.id),
  ]);

  return {
    shop,
    product,
    examSummary,
    previews,
    availableStock:
      product.delivery_type === "key" ? Number(availableStock ?? 0) : undefined,
  };
});

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const result = await loadProduct(slug, productSlug);
  if (!result) return { title: `ไม่พบสินค้า — ${BRAND_NAME}` };
  return {
    title: `${result.product.name} — ${result.shop.name}`,
    description:
      result.product.description?.slice(0, 155) ||
      `ซื้อ ${result.product.name} จาก ${result.shop.name}`,
  };
}

export default async function ProductDetailPage({ params }: { params: Params }) {
  const { slug, productSlug } = await params;
  const result = await loadProduct(slug, productSlug);
  if (!result) notFound();
  const { shop, product, examSummary, previews, availableStock } = result;

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
      <div className="absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3">
        <Link
          href={`/${shop.slug}`}
          className="min-w-0 truncate rounded-full bg-paper/90 px-4 py-2 text-xs font-semibold text-ink shadow-lift-1 backdrop-blur transition hover:bg-paper"
        >
          ‹ {shop.name}
        </Link>
        <div className="flex shrink-0 items-start gap-2">
          <DashboardShortcut />
          <ShareButton url={productUrl(shop.slug, product.slug || productSlug)} title={product.name} label="แชร์สินค้า" />
        </div>
      </div>

      <ProductGallery
        images={images}
        productName={product.name}
        deliveryType={product.delivery_type === "course" ? "course" : product.delivery_type === "key" ? "key" : "file"}
        filePageCount={product.delivery_type === "file" ? product.file_page_count ?? null : null}
      />

      <div className="px-[22px] pb-14 pt-6">
          <span className="inline-flex rounded-full bg-ink px-3 py-1.5 text-[10px] font-semibold text-paper">
            {productCategoryLabel(product.delivery_type)}
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
                  product.delivery_type === "course" ? "course" : product.delivery_type === "key" ? "key" : "file",
                courseAccessDays: product.course_access_days,
                availableStock,
              }}
            />
            <p className="mt-3 text-center text-[11px] text-muted">ชำระเงินปลอดภัยผ่าน Stripe</p>
          </div>

          {examSummary && (
            <ExamCourseOverview summary={examSummary} accessDays={product.course_access_days} />
          )}

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
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {previews.length > 0 && (
            <section aria-labelledby="product-previews" className={`mt-8 ${(product.highlights?.length ?? 0) > 0 ? "" : "border-t border-line pt-7"}`}>
              <h2 id="product-previews" className="text-xl font-bold text-ink">ตัวอย่าง</h2>
              <ProductPreviewGallery previews={previews} productName={product.name} />
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
              ดูสินค้าทั้งหมด<ArrowRightIcon className="ml-1.5 inline size-4 align-[-0.2em] transition-transform duration-[200ms] ease-out group-hover:translate-x-0.5" />
            </Link>
          </footer>
      </div>
    </ProductDetailShell>
  );
}
