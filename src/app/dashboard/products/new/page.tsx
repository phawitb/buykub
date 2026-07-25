import { redirect } from "next/navigation";
import { ProductEditor } from "@/features/products/components/ProductEditor";
import type { ProductEditorValue } from "@/features/products/model";
import { createClient } from "@/lib/supabase/server";

const initialValue: ProductEditorValue = {
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
