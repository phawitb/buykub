import { createClient } from "@/lib/supabase/server";
import { ShopForm } from "./ShopForm";

export default async function ShopSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, slug, name, bio")
    .eq("owner_id", user!.id)
    .maybeSingle();

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-ink">ตั้งค่าร้าน</h1>
      <p className="mt-1 text-sm text-muted">
        {shop
          ? "แก้ไขชื่อร้าน คำอธิบาย และลิงก์ของคุณ"
          : "ตั้งชื่อร้านและลิงก์ เพื่อเริ่มขายสินค้า"}
      </p>

      <div className="mt-8 rounded-2xl border border-line bg-paper-dim p-6">
        <ShopForm
          initial={
            shop ?? { id: null, slug: "", name: "", bio: "" }
          }
        />
      </div>
    </div>
  );
}
