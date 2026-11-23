import Link from "next/link";
import { redirect } from "next/navigation";
import { getSellerContext } from "@/lib/supabase/seller-context";
import { PromoCodeManager, type PromoCodeRow } from "./PromoCodeManager";

export const metadata = { title: "โค้ดส่วนลด" };

export default async function PromoCodesPage() {
  const { supabase, shop } = await getSellerContext();
  if (!shop) redirect("/dashboard/products?create=1");
  const [{ data: codes, error }, { data: usage }, { data: products }] = await Promise.all([
    supabase.from("promo_codes")
      .select("id, code, percent_off, amount_off_cents, product_ids, max_redemptions, once_per_user, expires_at, active, created_at")
      .eq("shop_id", shop.id).order("created_at", { ascending: false }),
    supabase.rpc("my_promo_code_usage"),
    supabase.from("products").select("id, name, price_cents").eq("shop_id", shop.id).order("created_at", { ascending: true }),
  ]);
  if (error) throw error;
  const used = new Map(((usage ?? []) as { promo_id: string; paid_uses: number }[]).map((row) => [row.promo_id, Number(row.paid_uses)]));
  const rows: PromoCodeRow[] = (codes ?? []).map((code) => ({ ...code, paid_uses: used.get(code.id) ?? 0 }));

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs text-muted">
        <Link href="/dashboard/products" className="hover:text-ink">ร้านค้าของฉัน</Link>
        {" / โค้ดส่วนลด"}
      </p>
      <h1 className="mt-2 text-xl font-bold text-ink">โค้ดส่วนลด</h1>
      <p className="mt-1 text-sm text-muted">
        ผู้ซื้อกรอกโค้ดตอนกดซื้อ หรือเปิดลิงก์สินค้าที่ต่อท้ายด้วย ?code=โค้ด ส่วนลดหักจากราคาขาย ค่าธรรมเนียม 5% และยอดโอนให้ร้านคิดจากราคาหลังหักส่วนลด
      </p>
      <PromoCodeManager shopId={shop.id} initialCodes={rows} products={products ?? []} />
    </div>
  );
}
