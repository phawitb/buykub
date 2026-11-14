import { redirect } from "next/navigation";
import { ProductEditor } from "@/features/products/components/ProductEditor";
import type { ProductEditorValue } from "@/features/products/model";
import { getSellerContext } from "@/lib/supabase/seller-context";

const initialValue: ProductEditorValue = {
  deliveryType: "file",
  courseAccessDays: "",
  keyInput: "",
  keyInventory: { available: 0, assigned: 0, disabled: 0 },
  name: "",
  price: "",
  comparePrice: "",
  category: "OTHER",
  descriptionHtml: "",
  productFile: null,
  images: [],
  highlights: [],
  faq: [],
  published: true,
};

export default async function NewProductPage() {
  const { supabase, user, shop } = await getSellerContext();

  if (!shop) redirect("/dashboard/products?create=1");

  const { data: products } = await supabase
    .from("products")
    .select("slug")
    .eq("shop_id", shop.id);

  return (
    <ProductEditor
      mode="create"
      shopId={shop.id}
      userId={user!.id}
      existingSlugs={(products ?? [])
        .map((product) => product.slug)
        .filter((slug): slug is string => Boolean(slug))}
      initialValue={initialValue}
    />
  );
}
