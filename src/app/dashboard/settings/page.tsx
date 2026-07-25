import { createClient } from "@/lib/supabase/server";
import { CommercialTerms } from "./CommercialTerms";
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
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">ตั้งค่า</h1>
      <p className="mt-1 text-sm text-muted">จัดการข้อมูลร้านค้าของคุณ</p>

      <div className="mt-8">
        <CommercialTerms />
      </div>

      <div className="mt-6 border-t border-line pt-10">
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
