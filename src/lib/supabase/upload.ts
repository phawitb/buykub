import { createClient } from "@/lib/supabase/client";

export async function uploadShopAsset(userId: string, file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("shop-assets").upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from("shop-assets").getPublicUrl(path);
  return data.publicUrl;
}
