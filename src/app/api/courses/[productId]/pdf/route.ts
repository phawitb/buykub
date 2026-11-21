import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGoogleUser } from "@/lib/auth";

export const runtime = "nodejs";
const headers = {"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const error = (message: string,status: number) => NextResponse.json({error:message},{status,headers});

/** The course's companion PDF, for whoever may enter the classroom right now: the owner or a buyer still in their access period. */
export async function GET(_request: Request,{params}:{params:Promise<{productId:string}>}) {
  const {productId}=await params;
  if(!uuid.test(productId)) return error("ไม่พบไฟล์ PDF",404);
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user||!isGoogleUser(user)) return error("กรุณาเข้าสู่ระบบด้วย Google",401);
  const access=await supabase.rpc("course_access",{p_product_id:productId});
  if(access.error) return error("ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองอีกครั้ง",503);
  if(!access.data?.allowed) return error("ไม่มีสิทธิ์เข้าถึงไฟล์ PDF ของคอร์สนี้",403);
  // Buyers cannot read product rows' file columns, so the path is looked up only after access is granted.
  const admin=createAdminClient();
  const {data:product,error:readError}=await admin.from("products")
    .select("delivery_type, file_path, file_name, shops(owner_id)").eq("id",productId).maybeSingle();
  if(readError) return error("โหลดไฟล์ PDF ไม่สำเร็จ",503);
  const shop=product?.shops as {owner_id?:string}|{owner_id?:string}[]|null|undefined;
  const ownerId=Array.isArray(shop)?shop[0]?.owner_id:shop?.owner_id;
  const path=product?.file_path as string|null|undefined;
  // Only a file inside the course owner's own upload folder is ever signed.
  if(product?.delivery_type!=="course"||!path||!ownerId||!/^[-a-zA-Z0-9_./]+$/.test(path)||path.split("/").some(part=>!part||part==="."||part==="..")||path.split("/")[0]!==ownerId) return error("ไม่พบไฟล์ PDF",404);
  try {
    const signed=await admin.storage.from("product-files").createSignedUrl(path,300,{download:(product.file_name as string|null)||true});
    if(signed.error||!signed.data?.signedUrl) return error("ไม่สามารถดาวน์โหลดไฟล์ PDF ได้",503);
    return new NextResponse(null,{status:303,headers:{...headers,Location:signed.data.signedUrl}});
  } catch {
    return error("ไม่สามารถดาวน์โหลดไฟล์ PDF ได้ กรุณาลองอีกครั้ง",503);
  }
}
