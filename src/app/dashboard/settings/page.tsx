import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug: desiredSlug } = await searchParams;
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, google_calendar_connected_at")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-ink">ตั้งค่า</h1>
      <p className="mt-1 text-sm text-muted">จัดการข้อมูลร้านค้าของคุณ</p>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-ink">การสมัครสมาชิก</h2>
        <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden>◇</span>
          <div>
            <p className="font-bold text-ink">Free</p>
            <p className="mt-0.5 text-xs text-muted">ค่าธรรมเนียม 8% · สินค้าสูงสุด 5 ชิ้น</p>
          </div>
        </div>
        <Link
          href="/dashboard/settings/upgrade"
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-paper transition hover:bg-accent-hover"
        >
          อัปเกรดเป็น Pro →
        </Link>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-muted">
        ระบบชำระเงินและค่าสมาชิกเป็น mockup — ยังไม่มีการเรียกเก็บเงินจริง
      </p>

      <div className="mt-10">
        <SettingsForm
          userId={user!.id}
          calendarConnected={Boolean(profile?.google_calendar_connected_at)}
          connectedEmail={profile?.email ?? user?.email ?? null}
          initial={
            shop ?? {
              id: null,
              slug: desiredSlug ?? "",
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
