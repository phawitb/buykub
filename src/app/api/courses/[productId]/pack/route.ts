import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGoogleUser } from "@/lib/auth";
import { examPackPath } from "@/features/courses/exam-prep/pack";

export const runtime = "nodejs";
const headers = {"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const error = (message: string,status: number) => NextResponse.json({error:message},{status,headers});

/** The paid study pack of an exam-prep course, for the owner or an entitled buyer only. */
export async function GET(_request: Request,{params}:{params:Promise<{productId:string}>}) {
  const {productId}=await params;
  if(!uuid.test(productId)) return error("ไม่พบคอร์ส",404);
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!isGoogleUser(user)) return error("กรุณาเข้าสู่ระบบด้วย Google",401);
  const access=await supabase.rpc("course_access",{p_product_id:productId});
  if(access.error) return error("ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองอีกครั้ง",503);
  if(!access.data?.allowed) return error("ไม่มีสิทธิ์เข้าเรียนคอร์สนี้",403);
  try {
    // Entitlement is settled above; the service role only resolves the owner's storage prefix.
    const admin=createAdminClient();
    const {data:product,error:productError}=await admin.from("products").select("course_format,shops(owner_id)").eq("id",productId).maybeSingle();
    if(productError) return error("โหลดคอร์สไม่สำเร็จ",503);
    const ownerId=(product?.shops as {owner_id?:string}|null)?.owner_id;
    if(product?.course_format!=="exam_prep"||!ownerId) return error("ไม่พบเนื้อหาคอร์ส",404);
    const file=await admin.storage.from("product-files").download(examPackPath(ownerId,productId));
    if(file.error||!file.data) return error("ผู้สอนยังไม่ได้อัปโหลดเนื้อหาคอร์ส",404);
    return new NextResponse(await file.data.text(),{headers:{...headers,"Content-Type":"application/json; charset=utf-8"}});
  } catch {
    return error("โหลดเนื้อหาคอร์สไม่สำเร็จ กรุณาลองอีกครั้ง",503);
  }
}
