import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatTHB } from "@/features/products/format";
import { formatBangkokDateTime } from "@/lib/bangkok-date";
import { getSellerContext } from "@/lib/supabase/seller-context";
import { OrderActions } from "./OrderActions";
import { ratePercent } from "@/lib/affiliates/referral";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const { supabase, shop } = await getSellerContext();
  if (!shop) redirect("/dashboard/products");

  const { data: order } = await supabase
    .from("orders")
    .select("id, buyer_name, buyer_email, payment_method, price_cents, status, created_at, fulfilment_email_status, fulfilment_token, products(name)")
    .eq("id", orderId)
    .eq("shop_id", shop.id)
    .maybeSingle();
  if (!order) notFound();

  const product = order.products as unknown as { name: string } | null;
  const status = order.status as "pending" | "paid" | "refunded" | "failed";
  const [{ data: assignedKey }, { data: referral }, { data: discount }] = await Promise.all([
    supabase
      .from("product_keys")
      .select("key_value")
      .eq("assigned_order_id", order.id)
      .eq("status", "assigned")
      .maybeSingle(),
    // Shops see what a referral withholds, never who referred.
    supabase
      .from("affiliate_commissions")
      .select("rate_bp, amount_cents, status")
      .eq("order_id", order.id)
      .maybeSingle<{ rate_bp: number; amount_cents: number; status: string }>(),
    supabase
      .rpc("shop_order_discount", { p_order: order.id })
      .maybeSingle<{ promo_code: string | null; list_cents: number | null; discount_cents: number }>()
      .then((result) => result, () => ({ data: null })),
  ]);

  return (
    <div className="max-w-2xl">
      <p className="text-xs text-muted">
        <Link href="/dashboard/analytics#orders" className="hover:text-ink">ออเดอร์</Link>
        {" / รายละเอียด"}
      </p>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink">รายละเอียดออเดอร์</h1>
          <p className="mt-1 font-mono text-xs text-muted">#{order.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
          status === "paid"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-paper-dim text-muted"
        }`}>
          {status === "paid" ? "ชำระแล้ว" : status === "pending" ? "รอชำระเงิน" : status === "refunded" ? "คืนเงินแล้ว" : "ชำระเงินไม่สำเร็จ"}
        </span>
      </div>

      <section className="mt-7 rounded-2xl border border-line p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted">สินค้า</p>
            <p className="mt-1 font-semibold text-ink">{product?.name ?? "สินค้า"}</p>
          </div>
          <p className="text-lg font-bold text-ink">{formatTHB(order.price_cents)}</p>
        </div>
        {discount && (
          <p className="mt-4 flex justify-between gap-4 border-t border-line pt-4 text-sm">
            <span className="text-muted">
              โค้ดส่วนลด{discount.promo_code ? ` ${discount.promo_code}` : ""}
              {discount.list_cents != null && ` · ราคาปกติ ${formatTHB(discount.list_cents)}`}
            </span>
            <span className="font-semibold text-ink">−{formatTHB(discount.discount_cents)}</span>
          </p>
        )}
        {referral && (
          <p className="mt-4 flex justify-between gap-4 border-t border-line pt-4 text-sm">
            <span className="text-muted">ผ่านลิงก์แนะนำ ({ratePercent(referral.rate_bp)}) {referral.status === "void" ? "· ยกเลิกเพราะคืนเงิน" : "· หักจากยอดโอนให้ร้าน"}</span>
            <span className={referral.status === "void" ? "text-muted line-through" : "font-semibold text-ink"}>−{formatTHB(Number(referral.amount_cents))}</span>
          </p>
        )}
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-line p-5">
          <h2 className="text-sm font-semibold text-ink">ข้อมูลผู้ซื้อ</h2>
          <p className="mt-3 text-sm text-ink">{order.buyer_name || "ไม่ระบุชื่อ"}</p>
          <p className="mt-1 text-xs text-muted">{order.buyer_email || "ไม่ระบุอีเมล"}</p>
        </section>
        <section className="rounded-2xl border border-line p-5">
          <h2 className="text-sm font-semibold text-ink">การชำระเงิน</h2>
          <p className="mt-3 text-sm text-ink">
            {order.payment_method === "stripe" ? "Stripe" : order.payment_method === "card" ? "บัตรเครดิต" : "PromptPay"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {formatBangkokDateTime(new Date(order.created_at))}
          </p>
        </section>
      </div>

      <div className="mt-6">
        <OrderActions
          orderId={order.id}
          assignedKey={assignedKey?.key_value}
          emailStatus={
            order.fulfilment_email_status as
              | "pending"
              | "sent"
              | "failed"
              | null
          }
          canRetryEmail={status === "paid" && Boolean(order.fulfilment_token)}
        />
      </div>
    </div>
  );
}
