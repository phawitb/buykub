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
    .select("id, name, description, price_cents, category, published")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  const count = products?.length ?? 0;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">สินค้า</h1>
          <p className="mt-1 text-sm text-muted">
            จัดการสินค้าดิจิทัลของคุณ ({count}/{FREE_PLAN_LIMIT} สินค้า)
          </p>
        </div>
        <Link
          href="/dashboard/products/new"
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper hover:bg-accent-hover"
        >
          เพิ่มสินค้า
        </Link>
      </div>

      <div className="mt-8 space-y-3">
        {(products ?? []).map((p) => (
          <ProductRow key={p.id} product={p} />
        ))}

        {count === 0 && (
          <div className="rounded-2xl border border-dashed border-line p-10 text-center">
            <p className="text-sm font-medium text-ink">ยังไม่มีสินค้า</p>
            <p className="mt-1 text-xs text-muted">เริ่มสร้างสินค้าดิจิทัลชิ้นแรกของคุณ</p>
            <Link
              href="/dashboard/products/new"
              className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper hover:bg-accent-hover"
            >
              สร้างสินค้าใหม่
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
