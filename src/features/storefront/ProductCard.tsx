import { productCategoryLabel } from "@/features/products/category";
import Link from "next/link";
import { ProductPlaceholder } from "./ProductPlaceholder";
import { formatTHB } from "@/features/products/format";

export type StorefrontProductCard = {
  name: string;
  slug: string;
  category: string;
  priceCents: number;
  comparePriceCents: number | null;
  thumbnailUrl: string | null;
  deliveryType?: "file" | "key" | "course";
  availableStock?: number;
};

/**
 * A white card on the grey ground, after fastwork's service cards: the whole
 * card is the link, the thumbnail sits inside the card rather than being the
 * card, and the price is the last thing the eye lands on.
 */
export function ProductCard({
  shopSlug,
  product,
}: {
  shopSlug: string;
  product: StorefrontProductCard;
}) {
  const stock = product.availableStock ?? 0;

  return (
    <Link
      href={`/${shopSlug}/${product.slug}`}
      aria-label={product.name}
      className="group card lift-card flex min-w-0 flex-col overflow-hidden p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="zoom-frame relative aspect-square rounded-element bg-paper-dim">
        {product.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            className="size-full object-cover"
          />
        ) : (
          <span data-zoom className="block size-full">
            <ProductPlaceholder productName={product.name} deliveryType={product.deliveryType} />
          </span>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-paper/90 px-2.5 py-1 text-[10px] font-medium text-ink backdrop-blur">
          {productCategoryLabel(product.deliveryType)}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-2 pb-1.5 pt-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-5 text-ink">
          {product.name}
        </h3>

        <p className="mt-auto flex items-baseline gap-2 pt-3 text-sm">
          <span className="font-semibold text-ink" data-numeric>
            {formatTHB(product.priceCents)}
          </span>
          {product.comparePriceCents && (
            <span className="text-xs text-muted line-through" data-numeric>
              {formatTHB(product.comparePriceCents)}
            </span>
          )}
        </p>

        {product.deliveryType === "key" && (
          <p
            className={`mt-1.5 text-xs font-medium ${
              stock > 0 ? (stock <= 5 ? "text-amber-700" : "text-success") : "text-error-solid"
            }`}
          >
            {stock > 0 ? `เหลือ ${stock} รายการ` : "สินค้าหมด"}
          </p>
        )}
      </div>
    </Link>
  );
}
