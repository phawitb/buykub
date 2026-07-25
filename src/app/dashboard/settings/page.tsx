import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select(
      "id, slug, name, bio, avatar_url, cover_url, accent_color, payout_method, promptpay_id, bank_details",
    )
    .eq("owner_id", user!.id)
    .maybeSingle();

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-ink">ตั้งค่า</h1>
      <p className="mt-1 text-sm text-muted">จัดการข้อมูลร้านค้าของคุณ</p>

      <div className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-paper p-5">
        <div>
          <p className="text-xs text-muted">การสมัครสมาชิก</p>
          <p className="mt-1 text-lg font-bold text-ink">Free</p>
          <p className="mt-0.5 text-xs text-muted">ค่าธรรมเนียม 8% · สินค้าสูงสุด 5 ชิ้น</p>
        </div>
        <Link
          href="/dashboard/settings/upgrade"
          className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-soft transition hover:border-ink hover:text-ink"
        >
          อัปเกรดเป็น Pro
        </Link>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-muted">
        ระบบชำระเงินและค่าสมาชิกเป็น mockup — ยังไม่มีการเรียกเก็บเงินจริง
      </p>

      <div className="mt-8">
        <SettingsForm
          userId={user!.id}
          initial={
            shop ?? {
              id: null,
              slug: "",
              name: "",
              bio: "",
              avatar_url: null,
              cover_url: null,
              accent_color: "#0a0a0a",
              payout_method: "promptpay",
              promptpay_id: "",
              bank_details: "",
            }
          }
        />
      </div>
    </div>
  );
}
