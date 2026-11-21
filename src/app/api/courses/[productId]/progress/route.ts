import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGoogleUser } from "@/lib/auth";

export const runtime = "nodejs";
const headers = {"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The database caps state at 512 KB; leave room for the {state, base} envelope.
const MAX_BODY = 600 * 1024;
const error = (message: string,status: number) => NextResponse.json({error:message},{status,headers});

async function authorize(productId: string) {
  if(!uuid.test(productId)) return {response:error("ไม่พบคอร์ส",404)};
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!isGoogleUser(user)) return {response:error("กรุณาเข้าสู่ระบบด้วย Google",401)};
  const access=await supabase.rpc("course_access",{p_product_id:productId});
  if(access.error) return {response:error("ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองอีกครั้ง",503)};
  if(!access.data?.allowed) return {response:error("ไม่มีสิทธิ์เข้าเรียนคอร์สนี้",403)};
  return {supabase};
}

export async function GET(_request: Request,{params}:{params:Promise<{productId:string}>}) {
  const {productId}=await params;
  const {supabase,response}=await authorize(productId);
  if(response) return response;
  // RLS limits rows to the caller's own progress on a course they can still open.
  const {data,error:readError}=await supabase.from("course_progress").select("state,updated_at").eq("product_id",productId).maybeSingle();
  if(readError) return error("โหลดความคืบหน้าไม่สำเร็จ",503);
  return NextResponse.json({state:data?.state ?? null,updated_at:data?.updated_at ?? null},{headers});
}

export async function PUT(request: Request,{params}:{params:Promise<{productId:string}>}) {
  const {productId}=await params;
  const {supabase,response}=await authorize(productId);
  if(response) return response;
  const text=await request.text();
  if(text.length>MAX_BODY) return error("ความคืบหน้ามีขนาดใหญ่เกินไป",413);
  let body: unknown;
  try { body=JSON.parse(text); } catch { return error("ข้อมูลไม่ถูกต้อง",400); }
  const {state,base}=(body ?? {}) as {state?: unknown; base?: unknown};
  if(!state||typeof state!=="object"||Array.isArray(state)||(base!==null&&base!==undefined&&typeof base!=="string")) return error("ข้อมูลไม่ถูกต้อง",400);
  const saved=await supabase.rpc("save_course_progress",{p_product_id:productId,p_state:state,p_base:base ?? null});
  if(saved.error) {
    if(saved.error.message.includes("course_access_denied")) return error("ไม่มีสิทธิ์เข้าเรียนคอร์สนี้",403);
    if(saved.error.message.includes("invalid_progress")) return error("ความคืบหน้ามีขนาดใหญ่เกินไป",413);
    return error("บันทึกความคืบหน้าไม่สำเร็จ",503);
  }
  const result=saved.data as {conflict:boolean;state?:unknown;updated_at:string};
  // Another device saved first: hand back its copy so the client can keep the newer one.
  if(result.conflict) return NextResponse.json({state:result.state,updated_at:result.updated_at},{status:409,headers});
  return NextResponse.json({updated_at:result.updated_at},{headers});
}
