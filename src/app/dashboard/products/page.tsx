import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "./ProductForm";
import { ProductRow } from "./ProductRow";

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
          <Link href="/dashboard/shop" className="font-semibold text-ink underline">
            ไปตั้งค่าร้าน
          </Link>
        </p>
      </div>
    );
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, name, description, price_cents, kind, published")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-ink">สินค้า</h1>
      <p className="mt-1 text-sm text-muted">สินค้าดิจิทัลและบริการจองของร้านคุณ</p>

      <div className="mt-8 rounded-2xl border border-line bg-paper-dim p-6">
        <ProductForm shopId={shop.id} />
      </div>

      <div className="mt-8 space-y-3">
        {(products ?? []).map((p) => (
          <ProductRow key={p.id} product={p} />
        ))}
        {(!products || products.length === 0) && (
          <p className="text-sm text-muted">ยังไม่มีสินค้า เพิ่มรายการแรกด้านบน</p>
        )}
      </div>
    </div>
  );
}
