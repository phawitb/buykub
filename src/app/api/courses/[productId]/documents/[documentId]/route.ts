import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGoogleUser } from "@/lib/auth";
import type { CourseDocument } from "@/features/courses/model";
import { normalizeDocumentUrl } from "@/features/courses/validation";

export const runtime = "nodejs";
const headers = {"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const error = (message: string,status: number) => NextResponse.json({error:message},{status,headers});

export async function GET(_request: Request,{params}:{params:Promise<{productId:string;documentId:string}>}) {
  const {productId,documentId}=await params;
  if(!uuid.test(productId)||!uuid.test(documentId)) return error("ไม่พบเอกสาร",404);
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!isGoogleUser(user)) return error("กรุณาเข้าสู่ระบบด้วย Google",401);
  const access=await supabase.rpc("course_access",{p_product_id:productId});
  if(access.error) return error("ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองอีกครั้ง",503);
  if(!access.data?.allowed) return error("ไม่มีสิทธิ์เข้าถึงเอกสารคอร์สนี้",403);
  const {data,error:readError}=await supabase.from("course_lessons").select("documents").eq("product_id",productId);
  if(readError) return error("โหลดเอกสารไม่สำเร็จ",503);
  const document=(data??[]).flatMap(row=>Array.isArray(row.documents)?row.documents as CourseDocument[]:[]).find(doc=>doc.id===documentId);
  if(!document) return error("ไม่พบเอกสาร",404);
  if(document.url && !document.path) {
    const url=normalizeDocumentUrl(document.url);
    return url?new NextResponse(null,{status:303,headers:{...headers,Location:url}}):error("ลิงก์เอกสารไม่ถูกต้อง",404);
  }
  // Storage interpolates paths into URLs. Reject encodings and URL metacharacters
  // before the service-role request can normalize them into another owner's path.
  if(!document.path||!/^[-a-zA-Z0-9_./]+$/.test(document.path)||document.path.split("/").some(part=>!part||part==="."||part==="..")||document.url) return error("ไม่พบเอกสาร",404);
  const attachmentAccess=await supabase.rpc("can_read_course_document",{p_path:document.path});
  if(attachmentAccess.error) return error("ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองอีกครั้ง",503);
  if(attachmentAccess.data!==true) return error("ไม่มีสิทธิ์เข้าถึงเอกสารคอร์สนี้",403);
  // Buyers cannot sign storage URLs directly; the server enforces a five-minute lifetime.
  try {
    const signed=await createAdminClient().storage.from("product-files").createSignedUrl(document.path,300,{download:document.name});
    if(signed.error||!signed.data?.signedUrl) return error("ไม่สามารถดาวน์โหลดเอกสารได้",503);
    return new NextResponse(null,{status:303,headers:{...headers,Location:signed.data.signedUrl}});
  } catch {
    return error("ไม่สามารถดาวน์โหลดเอกสารได้ กรุณาลองอีกครั้ง",503);
  }
}
