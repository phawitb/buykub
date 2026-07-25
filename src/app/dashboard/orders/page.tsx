import { createClient } from "@/lib/supabase/server";

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
        .select("id, price_cents, status, created_at, products(name)")
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const total = (orders ?? []).reduce((sum, o) => sum + o.price_cents, 0);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-ink">ออเดอร์ & เงิน</h1>
      <p className="mt-1 text-sm text-muted">
        รายการนี้เป็นข้อมูลทดลอง (Demo) — ยังไม่ได้เชื่อมระบบชำระเงินจริง
      </p>

      <div className="mt-8 rounded-2xl border border-line bg-ink px-6 py-5 text-paper">
        <p className="text-xs text-paper/60">ยอดขายรวม (Demo)</p>
        <p className="mt-1 text-2xl font-bold">
          ฿{(total / 100).toLocaleString("th-TH")}
        </p>
        <p className="mt-2 text-xs text-paper/50">
          รอบโอนจริงจะขึ้นที่นี่เมื่อเชื่อมต่อระบบชำระเงิน
        </p>
      </div>

      <div className="mt-8 space-y-2">
        {(orders ?? []).map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between rounded-xl border border-line bg-paper p-4 text-sm"
          >
            <div>
              <p className="font-medium text-ink">
                {(o.products as unknown as { name: string } | null)?.name ?? "สินค้า"}
              </p>
              <p className="text-xs text-muted">
                {new Date(o.created_at).toLocaleDateString("th-TH")}
              </p>
            </div>
            <span className="font-semibold text-ink">
              +฿{(o.price_cents / 100).toLocaleString("th-TH")}
            </span>
          </div>
        ))}
        {(!orders || orders.length === 0) && (
          <p className="text-sm text-muted">ยังไม่มีออเดอร์เข้ามา</p>
        )}
      </div>
    </div>
  );
}
