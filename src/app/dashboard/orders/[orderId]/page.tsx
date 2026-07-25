import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatTHB } from "@/features/products/format";
import { createClient } from "@/lib/supabase/server";
import { OrderActions } from "./OrderActions";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!shop) redirect("/dashboard/settings");

  const { data: order } = await supabase
    .from("orders")
    .select("id, buyer_name, buyer_email, payment_method, price_cents, status, mock, created_at, products(name)")
    .eq("id", orderId)
    .eq("shop_id", shop.id)
    .maybeSingle();
  if (!order) notFound();

  const product = order.products as unknown as { name: string } | null;
  const status = order.status as "paid" | "refunded";

  return (
    <div className="max-w-2xl">
      <p className="text-xs text-muted">
        <Link href="/dashboard/orders" className="hover:text-ink">ออเดอร์</Link>
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
          {status === "paid" ? "ชำระแล้ว" : "คืนเงินแล้ว"}
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
            {order.payment_method === "card" ? "บัตรเครดิต" : "PromptPay"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {new Date(order.created_at).toLocaleString("th-TH")}
          </p>
          {order.mock && <p className="mt-2 text-xs font-medium text-amber-700">รายการทดลอง · ไม่มีการตัดเงินจริง</p>}
        </section>
      </div>

      <div className="mt-6">
        <OrderActions orderId={order.id} status={status} />
      </div>
    </div>
  );
}
