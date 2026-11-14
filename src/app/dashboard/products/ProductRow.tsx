import Link from "next/link";
import type { ProductAsset } from "@/features/products/asset-cleanup";
import { formatTHB } from "@/features/products/format";
import { ProductActions } from "./ProductActions";

export type ProductListItem = {
  id: string;
  shop_id: string;
  name: string;
  slug: string | null;
  description: string | null;
  price_cents: number;
  compare_price_cents: number | null;
  category: string;
  published: boolean;
  delivery_type?: string;
  thumbnailUrl: string | null;
  assets: ProductAsset[];
};

export function ProductRow({
  product,
  shopSlug,
}: {
  product: ProductListItem;
  shopSlug: string;
}) {
  const productSlug = product.slug || `product-${product.id.slice(0, 8)}`;

  return (
    <article className="group rounded-2xl border border-line bg-paper p-3 transition hover:border-ink/20 sm:p-4">
      <div className="flex items-start gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-paper-dim sm:h-24 sm:w-24">
          {product.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.thumbnailUrl}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              role="img"
              aria-label={`ยังไม่มีรูปสำหรับ ${product.name}`}
              className="flex h-full w-full items-center justify-center text-xl text-muted"
            >
              ◇
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-paper-dim px-2 py-1 text-[10px] font-semibold text-ink-soft">
              {product.category}
            </span>
            <span
              className={`text-[11px] font-medium ${
                product.published ? "text-emerald-700" : "text-muted"
              }`}
            >
              {product.published ? "เผยแพร่แล้ว" : "แบบร่าง"}
            </span>
          </div>
          <h2 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-ink sm:text-base">
            {product.name}
          </h2>
          <p className="mt-2 flex items-baseline gap-2 text-sm">
            <span className="font-bold text-ink">{formatTHB(product.price_cents)}</span>
            {product.compare_price_cents && (
              <span className="text-xs text-muted line-through">
                {formatTHB(product.compare_price_cents)}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Link
          href={`/dashboard/products/${product.id}/edit`}
          className="small-button"
        >
          แก้ไข
        </Link>
        <Link
          href={`/${shopSlug}/${productSlug}`}
          target="_blank"
          className="small-button"
        >
          ดูหน้าขาย
        </Link>
        {product.delivery_type === "course" && <Link className="small-button" href={`/dashboard/products/${product.id}/lessons`}>จัดการบทเรียน</Link>}
        <div className="ml-auto">
          <ProductActions
            productId={product.id}
            shopId={product.shop_id}
            productName={product.name}
            published={product.published}
            assets={product.assets}
          />
        </div>
      </div>
    </article>
  );
}
