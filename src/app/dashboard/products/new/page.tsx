import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductNewForm } from "./ProductNewForm";

export default async function NewProductPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user!.id)
    .maybeSingle();

  if (!shop) redirect("/dashboard/settings");

  return (
    <div className="max-w-2xl">
      <p className="text-xs text-muted">
        <Link href="/dashboard/products" className="hover:text-ink">
          สินค้า
        </Link>{" "}
        / สร้างสินค้าใหม่
      </p>
      <h1 className="mt-1 text-xl font-bold text-ink">สร้างสินค้าใหม่</h1>

      <div className="mt-8">
        <ProductNewForm shopId={shop.id} userId={user!.id} />
      </div>
    </div>
  );
}
