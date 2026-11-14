import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { PayoutError } from "./errors";
const BUCKET="seller-payout-slips";
export const MAX_SLIP_BYTES=4*1024*1024;
export function validateSlip(mime:string,bytes:Uint8Array,size:number):string {
 if(!Number.isSafeInteger(size)||size<=0||size>MAX_SLIP_BYTES)throw new PayoutError("สลิปต้องมีขนาดไม่เกิน 4 MB และไม่ใช่ไฟล์ว่าง");
 const starts=(signature:number[],offset=0)=>signature.every((value,index)=>bytes[index+offset]===value);
 if(mime==="image/png"&&starts([137,80,78,71,13,10,26,10]))return "png";
 if(mime==="image/jpeg"&&starts([255,216,255]))return "jpg";
 if(mime==="image/webp"&&starts([82,73,70,70])&&starts([87,69,66,80],8))return "webp";
 if(mime==="application/pdf"&&starts([37,80,68,70,45]))return "pdf";
 throw new PayoutError("รับเฉพาะสลิป PNG, JPEG, WebP หรือ PDF ที่รูปแบบไฟล์ถูกต้อง");
}
export async function uploadPayoutSlip(actorId:string,batchId:string,file:File):Promise<{attached:true}> {
 if(!/^[0-9a-f-]{36}$/i.test(batchId))throw new PayoutError("รหัสชุดจ่ายเงินไม่ถูกต้อง");
 if(file.size>MAX_SLIP_BYTES)throw new PayoutError("สลิปต้องมีขนาดไม่เกิน 4 MB");
 const content=new Uint8Array(await file.arrayBuffer());const extension=validateSlip(file.type,content,file.size);
 const db=createAdminClient();const path=`${batchId}/${randomUUID()}.${extension}`;
 const {error:uploadError}=await db.storage.from(BUCKET).upload(path,content,{contentType:file.type,upsert:false,cacheControl:"0"});
 if(uploadError)throw new PayoutError("อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่และตรวจสอบพื้นที่จัดเก็บส่วนตัว");
 const {data:previous,error}=await db.rpc("attach_seller_payout_slip",{p_actor:actorId,p_batch:batchId,p_path:path,p_mime:file.type,p_size:file.size});
 if(error) {
  // A transport error may arrive AFTER the attachment committed. Keep this
  // private object; deleting it could erase an already-recorded receipt.
  throw new PayoutError(error.message==="completed_slip_immutable"?"สลิปของชุดที่บันทึกจ่ายแล้วไม่สามารถเปลี่ยนได้":"แนบสลิปไม่ได้ กรุณาตรวจสอบสถานะชุดจ่ายเงินและลองใหม่");
 }
 if(typeof previous==="string"&&previous!==path)await db.storage.from(BUCKET).remove([previous]);
 return {attached:true};
}
export async function getPayoutSlipUrl(batchId:string):Promise<{url:string}> {
 const db=createAdminClient();const {data,error}=await db.from("seller_payout_slips").select("object_path").eq("batch_id",batchId).single();
 if(error||!data)throw new PayoutError("ไม่พบสลิปสำหรับชุดจ่ายเงินนี้");
 const {data:link,error:linkError}=await db.storage.from(BUCKET).createSignedUrl(data.object_path,60,{download:true});
 if(linkError||!link)throw new PayoutError("ไม่สามารถเปิดสลิปได้ กรุณาลองใหม่");
 return {url:link.signedUrl};
}
