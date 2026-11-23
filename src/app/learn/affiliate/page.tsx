import Link from "next/link";
import { DashboardLayoutContent } from "@/app/dashboard/DashboardLayoutContent";
import { getSellerContext } from "@/lib/supabase/seller-context";
import { ratePercent } from "@/lib/affiliates/referral";
import { AffiliatePayoutForm } from "./AffiliatePayoutForm";

export const dynamic = "force-dynamic";

type Commission = { product_id: string; product_name: string; created_at: string; rate_bp: number; amount_cents: number; status: "pending" | "payable" | "paid" | "void" };

const statusLabels: Record<Commission["status"], string> = {
  pending: "รอร้านค้ารับเงิน", payable: "รอโอน", paid: "โอนแล้ว", void: "ยกเลิก (คืนเงิน)",
};
const baht = (cents: number) => `฿${(cents / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
const dateLabel = (value: string) => new Date(value).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" });

/** What the signed-in buyer earned from referral links, and where to send it. */
export default async function AffiliatePage() {
  const { supabase, user, shop } = await getSellerContext();
  const [{ data, error }, { data: profile }] = await Promise.all([
    supabase.rpc("my_affiliate_commissions"),
    supabase.from("affiliate_payout_profiles")
      .select("payout_method, promptpay_id, bank_details, full_name_th, contact_phone, national_id, address_line, subdistrict, district, province, postal_code")
      .eq("user_id", user.id).maybeSingle(),
  ]);
  const commissions = (data ?? []) as Commission[];
  const total = (status: Commission["status"]) => commissions.filter(row => row.status === status).reduce((sum, row) => sum + Number(row.amount_cents), 0);

  return (
    <DashboardLayoutContent
      user={{ email: user.email ?? null, fullName: user.user_metadata?.full_name ?? null, avatarUrl: user.user_metadata?.avatar_url ?? null }}
      shop={shop ? { name: shop.name, slug: shop.slug, avatarUrl: shop.avatar_url } : null}
    >
      <div className="mx-auto max-w-4xl">
        <Link href="/learn" className="text-sm text-muted">‹ รายการที่สั่งซื้อ</Link>
        <h1 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">รายได้จากลิงก์แนะนำ</h1>
        <p className="mt-3 text-sm leading-7 text-muted">กดปุ่ม “ชวนเพื่อน” ที่สินค้าซึ่งคุณซื้อแล้วเพื่อคัดลอกลิงก์ เมื่อมีคนซื้อผ่านลิงก์ภายใน 30 วัน คุณจะได้ค่าคอมตาม % ที่ร้านค้ากำหนด ผู้ซื้อจ่ายราคาปกติ</p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {([["รอร้านค้ารับเงิน", total("pending")], ["รอโอน", total("payable")], ["โอนแล้ว", total("paid")]] as const).map(([label, cents]) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-4">
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 text-lg font-bold text-ink sm:text-2xl">{baht(cents)}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-6 text-muted">ค่าคอมจะพร้อมโอนหลังร้านค้าได้รับเงินจากคำสั่งซื้อนั้นแล้ว (อย่างน้อย 7 วันหลังซื้อ) ทีมงานโอนให้เดือนละครั้งตามข้อมูลรับเงินด้านล่าง ถ้าคำสั่งซื้อถูกคืนเงินก่อนโอน ค่าคอมของรายการนั้นจะถูกยกเลิก</p>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-ink">รายการค่าคอม</h2>
          {error ? <p role="alert" className="mt-3 text-sm text-red-600">โหลดรายการไม่สำเร็จ กรุณาลองใหม่</p>
            : commissions.length === 0 ? <p className="mt-3 rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-muted">ยังไม่มีคนซื้อผ่านลิงก์ของคุณ</p>
            : <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-paper">
                {commissions.map((row, index) => (
                  <li key={index} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{row.product_name}</p>
                      <p className="mt-0.5 text-xs text-muted">{dateLabel(row.created_at)} · {ratePercent(row.rate_bp)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-semibold ${row.status === "void" ? "text-muted line-through" : "text-ink"}`}>{baht(Number(row.amount_cents))}</p>
                      <p className={`mt-0.5 text-xs ${row.status === "paid" ? "text-emerald-700" : "text-muted"}`}>{statusLabels[row.status]}</p>
                    </div>
                  </li>
                ))}
              </ul>}
        </section>

        <section className="mt-10 border-t border-line pt-10">
          <AffiliatePayoutForm userId={user.id} initial={{ payout_method: "promptpay", promptpay_id: null, bank_details: null, ...profile }} />
        </section>
      </div>
    </DashboardLayoutContent>
  );
}
