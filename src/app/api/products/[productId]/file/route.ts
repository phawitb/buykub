import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGoogleUser } from "@/lib/auth";

export const runtime = "nodejs";
const headers = {"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const error = (message: string,status: number) => NextResponse.json({error:message},{status,headers});

/** Lets a shop owner open their own product file the way a buyer receives it, without an order. */
export async function GET(_request: Request,{params}:{params:Promise<{productId:string}>}) {
  const {productId}=await params;
  if(!uuid.test(productId)) return error("ไม่พบไฟล์",404);
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user||!isGoogleUser(user)) return error("กรุณาเข้าสู่ระบบด้วย Google",401);
  // Published products are readable by anyone, so ownership is checked explicitly.
  const {data:product,error:readError}=await supabase.from("products")
    .select("file_path, file_name, delivery_type, shops!inner(owner_id)").eq("id",productId).maybeSingle();
  if(readError) return error("ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองอีกครั้ง",503);
  const owner=(product?.shops as {owner_id?:string}|{owner_id?:string}[]|null|undefined);
  const ownerId=Array.isArray(owner)?owner[0]?.owner_id:owner?.owner_id;
  if(!product||ownerId!==user.id) return error("ไม่มีสิทธิ์เข้าถึงไฟล์นี้",403);
  const path=product.file_path as string|null;
  // Owners upload into their own folder; anything else is refused before the service-role request.
  if(product.delivery_type!=="file"||!path||!/^[-a-zA-Z0-9_./]+$/.test(path)||path.split("/").some(part=>!part||part==="."||part==="..")||path.split("/")[0]!==user.id) return error("ไม่พบไฟล์",404);
  try {
    const signed=await createAdminClient().storage.from("product-files").createSignedUrl(path,300,{download:(product.file_name as string|null)||true});
    if(signed.error||!signed.data?.signedUrl) return error("ไม่สามารถดาวน์โหลดไฟล์ได้",503);
    return new NextResponse(null,{status:303,headers:{...headers,Location:signed.data.signedUrl}});
  } catch {
    return error("ไม่สามารถดาวน์โหลดไฟล์ได้ กรุณาลองอีกครั้ง",503);
  }
}
