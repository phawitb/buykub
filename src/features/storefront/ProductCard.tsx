import { productCategoryLabel } from "@/features/products/category";
import Link from "next/link";
import { ProductPlaceholder } from "./ProductPlaceholder";
import { formatTHB } from "@/features/products/format";
import { UsersIcon } from "@/components/icons";

export type StorefrontProductCard = {
  name: string;
  slug: string;
  category: string;
  priceCents: number;
  comparePriceCents: number | null;
  thumbnailUrl: string | null;
  deliveryType?: "file" | "key" | "course";
  availableStock?: number;
  /** People who have bought; shown only once there is at least one. */
  buyerCount?: number;
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
  const soldOut = product.deliveryType === "key" && stock <= 0;

  return (
    <Link
      href={`/${shopSlug}/${product.slug}`}
      aria-label={product.name}
      className="group card lift-card flex min-w-0 flex-col overflow-hidden p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {/* A cover keeps the shape it was uploaded in, so nothing on it is cropped away. */}
      <div className={`zoom-frame relative rounded-element bg-paper-dim ${product.thumbnailUrl ? "" : "aspect-square"}`}>
        {product.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            className="block h-auto w-full"
          />
        ) : (
          <span data-zoom className="block size-full">
            <ProductPlaceholder productName={product.name} deliveryType={product.deliveryType} />
          </span>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-paper/90 px-2.5 py-1 text-[10px] font-medium text-ink backdrop-blur">
          {productCategoryLabel(product.deliveryType)}
        </span>
        {(product.buyerCount ?? 0) > 0 && (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-paper/90 px-2.5 py-1 text-[10px] font-medium text-ink backdrop-blur">
            <UsersIcon className="size-3" />
            ซื้อแล้ว <span className="font-semibold" data-numeric>{product.buyerCount!.toLocaleString("th-TH")}</span> คน
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-2 pb-1.5 pt-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-5 text-ink">
          {product.name}
        </h3>

        {/* The buy pill is part of the card's one link: checkout happens on the product page, where the buyer signs in and pays. */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-semibold text-ink" data-numeric>
              {formatTHB(product.priceCents)}
            </span>
            {product.comparePriceCents && (
              <span className="text-xs text-muted line-through" data-numeric>
                {formatTHB(product.comparePriceCents)}
              </span>
            )}
          </p>
          {soldOut ? (
            <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-paper-dim px-3.5 text-xs font-medium text-muted">
              สินค้าหมด
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="inline-flex h-8 shrink-0 items-center rounded-full bg-accent px-4 text-xs font-semibold text-on-ink transition duration-[120ms] ease-out group-hover:bg-accent-hover group-active:scale-[0.97]"
            >
              ดูรายละเอียด
            </span>
          )}
        </div>

        {product.deliveryType === "key" && !soldOut && (
          <p
            className={`mt-1.5 text-xs font-medium ${
              stock <= 5 ? "text-amber-700" : "text-success"
            }`}
          >
            {`เหลือ ${stock} รายการ`}
          </p>
        )}
      </div>
    </Link>
  );
}
