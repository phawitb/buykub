import { createClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB — Supabase's default per-file limit

export async function uploadShopAsset(userId: string, file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`ไฟล์ใหญ่เกินไป (สูงสุด ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
  }

  const supabase = createClient();
  const ext = file.name.split(".").pop();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  let uploadError;
  try {
    ({ error: uploadError } = await supabase.storage.from("shop-assets").upload(path, file));
  } catch {
    throw new Error("อัปโหลดไม่สำเร็จ — เชื่อมต่อกับ Supabase Storage ไม่ได้ ลองใหม่อีกครั้ง");
  }

  if (uploadError) {
    throw new Error(`อัปโหลดไม่สำเร็จ: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from("shop-assets").getPublicUrl(path);
  return data.publicUrl;
}
