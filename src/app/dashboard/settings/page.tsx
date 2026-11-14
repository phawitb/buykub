import { redirect } from "next/navigation";
import { getSellerContext } from "@/lib/supabase/seller-context";
import { CommercialTerms } from "./CommercialTerms";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage({ searchParams }: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug: desiredSlug } = await searchParams;
  const { supabase, user, shop: sellerShop } = await getSellerContext();
  if (!sellerShop && desiredSlug) redirect(`/dashboard/products?slug=${encodeURIComponent(desiredSlug)}`);
  if (!sellerShop) redirect("/learn");
  const { data: payout, error } = await supabase.from("seller_payout_profiles")
    .select("payout_method, promptpay_id, bank_details, full_name_th, contact_phone, national_id, address_line, subdistrict, district, province, postal_code")
    .eq("shop_id", sellerShop.id).maybeSingle();
  if (error) throw error;

  return <div className="mx-auto max-w-4xl">
    <h1 className="text-xl font-bold text-ink">ตั้งค่า</h1>
    <p className="mt-1 text-sm text-muted">จัดการข้อมูลรับเงินของคุณ</p>
    <div className="mt-8"><CommercialTerms /></div>
    <div className="mt-6 border-t border-line pt-10">
      <SettingsForm userId={user.id} initial={{ id: sellerShop.id, payout_method: "promptpay", promptpay_id: null, bank_details: null, ...payout }} />
    </div>
  </div>;
}
