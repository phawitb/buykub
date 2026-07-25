import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductRow } from "./ProductRow";

const FREE_PLAN_LIMIT = 5;

export default async function ProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, slug")
    .eq("owner_id", user!.id)
    .maybeSingle();

  if (!shop) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-bold text-ink">สินค้า</h1>
        <p className="mt-3 text-sm text-ink-soft">
          ตั้งชื่อร้านก่อนเพิ่มสินค้า —{" "}
          <Link href="/dashboard/settings" className="font-semibold text-ink underline">
            ไปตั้งค่าร้าน
          </Link>
        </p>
      </div>
    );
  }

  const { data: products } = await supabase
    .from("products")
    .select(
      "id, shop_id, name, slug, description, price_cents, compare_price_cents, category, published, images, images_v2, file_path",
    )
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  const count = products?.length ?? 0;
  const listItems = (products ?? []).map((product) => {
    const imagesV2 = Array.isArray(product.images_v2)
      ? (product.images_v2 as Array<{ path?: string; publicUrl?: string }>)
      : [];
    return {
      id: product.id,
      shop_id: product.shop_id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price_cents: product.price_cents,
      compare_price_cents: product.compare_price_cents,
      category: product.category,
      published: product.published,
      thumbnailUrl: imagesV2[0]?.publicUrl ?? product.images?.[0] ?? null,
      assets: [
        ...(product.file_path
          ? [{ destination: "product-file" as const, path: product.file_path }]
          : []),
        ...imagesV2
          .filter(
            (image): image is { path: string; publicUrl?: string } =>
              Boolean(image.path),
          )
          .map((image) => ({
            destination: "product-image" as const,
            path: image.path,
          })),
      ],
    };
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">สินค้า</h1>
          <p className="mt-1 text-xs text-muted sm:text-sm">
            จัดการสินค้าดิจิทัลของคุณ ({count}/{FREE_PLAN_LIMIT} สินค้า)
          </p>
        </div>
        <Link
          href="/dashboard/products/new"
          className="primary-button shrink-0"
        >
          ＋ เพิ่มสินค้า
        </Link>
      </div>

      <div className="mt-8 space-y-4">
        {listItems.map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            shopSlug={shop.slug}
          />
        ))}

        {count === 0 && (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-line p-8 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-xl text-accent" aria-hidden>
              ◇
            </div>
            <p className="text-sm font-semibold text-ink">ยังไม่มีสินค้า</p>
            <p className="mt-1 text-xs text-muted">เริ่มสร้างสินค้าดิจิทัลชิ้นแรกของคุณ</p>
            <Link
              href="/dashboard/products/new"
              className="mt-6 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-paper hover:bg-accent-hover"
            >
              สร้างสินค้าใหม่
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
