import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-ink">การตั้งค่า</h1>

      <div className="mt-8 rounded-2xl border border-line bg-paper-dim p-6">
        <p className="text-xs font-medium text-ink-soft">อีเมล</p>
        <p className="mt-1 text-sm text-ink">{user?.email}</p>

        <p className="mt-5 text-xs font-medium text-ink-soft">เข้าสู่ระบบด้วย</p>
        <p className="mt-1 text-sm text-ink">Google</p>
      </div>
    </div>
  );
}
