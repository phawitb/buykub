import { createClient } from "@/lib/supabase/server";
import { OrderTabs } from "./OrderTabs";

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user!.id)
    .maybeSingle();

  const { data: orders } = shop
    ? await supabase
        .from("orders")
        .select("id, buyer_name, buyer_email, payment_method, mock, price_cents, status, created_at, products(name)")
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const list = (orders ?? []) as unknown as {
    id: string;
    buyer_name: string | null;
    buyer_email: string | null;
    payment_method: string | null;
    mock: boolean;
    price_cents: number;
    status: string;
    created_at: string;
    products: { name: string } | null;
  }[];

  const totalSales = list
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + o.price_cents, 0);

  const guaranteeCutoff = new Date(new Date().getTime() - 7 * 86400000).toISOString();
  const pendingPayout = list
    .filter((o) => o.status === "paid" && o.created_at >= guaranteeCutoff)
    .reduce((sum, o) => sum + o.price_cents, 0);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-ink">ออเดอร์</h1>
      <p className="mt-1 text-sm text-muted">ดูประวัติการสั่งซื้อและรายได้</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="rounded-2xl border border-line bg-paper p-5">
          <p className="text-xs text-muted">ยอดขายทั้งหมด</p>
          <p className="mt-1 text-lg font-bold text-ink">
            ฿{(totalSales / 100).toLocaleString("th-TH")}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-5">
          <p className="text-xs text-muted">ยอดรอจ่าย (ประมาณ)</p>
          <p className="mt-1 text-lg font-bold text-emerald-600">
            ฿{(pendingPayout / 100).toLocaleString("th-TH")}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-5">
          <p className="text-xs text-muted">จำนวนออเดอร์</p>
          <p className="mt-1 text-lg font-bold text-ink">{list.length}</p>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted">
        ข้อมูลนี้เป็นข้อมูลทดลอง (Demo) — ยังไม่ได้เชื่อมระบบชำระเงินจริง
      </p>

      <div className="mt-4">
        <OrderTabs orders={list} />
      </div>
    </div>
  );
}
