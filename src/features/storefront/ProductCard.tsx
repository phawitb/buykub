import Link from "next/link";
import { formatTHB } from "@/features/products/format";

export type StorefrontProductCard = {
  name: string;
  slug: string;
  category: string;
  priceCents: number;
  comparePriceCents: number | null;
  thumbnailUrl: string | null;
  deliveryType?: "file" | "key";
  availableStock?: number;
};

export function ProductCard({
  shopSlug,
  product,
}: {
  shopSlug: string;
  product: StorefrontProductCard;
}) {
  return (
    <Link
      href={`/${shopSlug}/${product.slug}`}
      aria-label={product.name}
      className="group block min-w-0 focus-visible:rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-paper-dim">
        {product.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div
            role="img"
            aria-label={`ยังไม่มีรูปสำหรับ ${product.name}`}
            className="flex h-full w-full flex-col items-center justify-center bg-[linear-gradient(145deg,var(--color-paper-dim),var(--color-accent-soft))] text-muted"
          >
            <span className="text-4xl">◇</span>
            <span className="mt-2 text-xs">ยังไม่มีรูปสินค้า</span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-ink/85 px-3 py-1.5 text-[10px] font-semibold text-paper backdrop-blur">
          {product.category}
        </span>
      </div>
      <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-ink">
        {product.name}
      </h3>
      <p className="mt-2 flex items-baseline gap-2 text-sm">
        <span className="font-bold text-ink">{formatTHB(product.priceCents)}</span>
        {product.comparePriceCents && (
          <span className="text-xs text-muted line-through">
            {formatTHB(product.comparePriceCents)}
          </span>
        )}
      </p>
      {product.deliveryType === "key" && (
        <p
          className={`mt-2 text-xs font-semibold ${
            (product.availableStock ?? 0) > 0
              ? (product.availableStock ?? 0) <= 5
                ? "text-amber-700"
                : "text-emerald-700"
              : "text-red-600"
          }`}
        >
          {(product.availableStock ?? 0) > 0
            ? `เหลือ ${product.availableStock} รายการ`
            : "สินค้าหมด"}
        </p>
      )}
    </Link>
  );
}
