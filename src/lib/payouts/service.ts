import "server-only";
import { PayoutError } from "./errors";
export { PayoutError } from "./errors";
export { uploadPayoutSlip, getPayoutSlipUrl } from "./slips";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { assessPayment, validateRecipient, type Assessment, type PayoutOrder } from "./eligibility";
import { readStripePayment } from "./stripe-reconcile";
import { PROVIDER_REASON, type PayoutDashboard, type PayoutInstructions, type PayoutMode, type PayoutBatchSummary } from "./model";

type Row=Record<string,unknown>;
type Db=ReturnType<typeof createAdminClient>;
function fail(error:unknown):asserts error is null|undefined {if(error) throw new PayoutError("ไม่สามารถอ่านหรือบันทึกบัญชีการจ่ายเงินได้ กรุณาตรวจสอบการติดตั้งฐานข้อมูลและลองใหม่");}
async function rows(db:Db,table:string,columns="*",limit=50000):Promise<Row[]> {
 const collected:Row[]=[];
 for(let offset=0;offset<=limit;offset+=500) {
  const {data,error}=await db.from(table).select(columns).range(offset,Math.min(offset+499,limit));fail(error);
  collected.push(...(data||[]) as unknown as Row[]);
  if(collected.length>limit) throw new PayoutError("ข้อมูลเกินขีดจำกัดการตรวจสอบรอบนี้ ต้องแบ่งรอบตรวจสอบก่อนจัดจ่ายเงิน");
  if(!data||data.length<500) return collected;
 }
 return collected;
}
async function rpc(db:Db,name:string,args:Row={}) {
 const {data,error}=await db.rpc(name,args);
 if(error) {
  const messages:Record<string,string>={
   seller_payout_hold:"บัญชีผู้ขายถูกพักการจ่ายเงิน",previous_payout_requires_review:"รายการที่เคยจ่ายมีเงินคืน ข้อพิพาท หรือยังตรวจสอบใหม่ไม่ได้ ต้องตรวจสอบก่อนจ่ายเพิ่ม",
   payout_profile_incomplete_or_name_mismatch:"ข้อมูลผู้รับไม่ครบหรือชื่อบัญชีไม่ตรงกับชื่อผู้ขาย",
   recipient_changed_cancel_and_prepare_again:"ข้อมูลผู้รับเปลี่ยน กรุณายกเลิกชุดเดิมและเตรียมใหม่",
   eligibility_changed_reconcile_and_review:"สถานะเงินเปลี่ยน กรุณาตรวจสอบและเตรียมชุดใหม่",
   batch_not_ready:"ชุดนี้ไม่พร้อมบันทึกการจ่าย กรุณาตรวจสอบหรือยกเลิกแล้วเตรียมใหม่",
   invalid_real_bank_reference_or_date:"กรอกเลขอ้างอิงธนาคารจริงอย่างน้อย 6 ตัว และเวลาที่โอนหลังเตรียมชุด",
   bank_transfer_provider_not_connected:PROVIDER_REASON,
   slip_attached_possible_transfer_do_not_cancel:"มีสลิปแนบแล้ว อาจมีการโอนจริง ไม่สามารถยกเลิกและจัดจ่ายซ้ำได้",
   payout_slip_required:"กรุณาแนบสลิปโอนเงินจริงก่อนบันทึกว่าจ่ายแล้ว",
  };
  if(error.code==="23505") throw new PayoutError("รายการชำระเงินหรือเลขอ้างอิงธนาคารนี้ถูกใช้แล้ว ไม่สามารถบันทึกซ้ำได้");
  throw new PayoutError(messages[error.message]||"ไม่สามารถดำเนินการชุดจ่ายเงินได้ กรุณาตรวจสอบสถานะล่าสุด");
 }
 return data;
}
function isFresh(value:unknown) {return typeof value==="string"&&Date.parse(value)>=Date.now()-5*60000;}
async function load(db:Db) {
 const [orders,profiles,shops,controls,observations,allocations,batches,settings,slips]=await Promise.all([
  rows(db,"orders","id,shop_id,status,mock,price_cents,payment_method,stripe_payment_intent_id,paid_at"),
  rows(db,"seller_payout_profiles"),rows(db,"shops","id,owner_id,name"),rows(db,"admin_user_controls","user_id,payout_hold"),
  rows(db,"seller_payout_observations"),rows(db,"seller_payout_allocations"),rows(db,"seller_payout_batches"),rows(db,"seller_payout_settings"),rows(db,"seller_payout_slips","batch_id")]);
 return {orders,profiles,shops,controls,observations,allocations,batches,settings,slips};
}
function shopReviewSet(state:Awaited<ReturnType<typeof load>>) {
 const blocked=new Set<string>();
 const batches=new Map(state.batches.map(b=>[b.id,b])),observations=new Map(state.observations.map(v=>[v.order_id,v])),orders=new Map(state.orders.map(o=>[o.id,o]));
 for(const a of state.allocations) {
  if(a.released_at) continue;
  const b=batches.get(a.batch_id); if(b?.status!=="completed")continue;
  const v=observations.get(a.order_id);
  const order=orders.get(a.order_id);
  if(!order||order.status!=="paid"||order.mock||order.payment_method!=="stripe"||Number(order.price_cents)!==Number(a.gross_cents)||order.stripe_payment_intent_id!==a.payment_intent_id||!v||!v.eligible||!isFresh(v.checked_at)||Number(v.refunded_cents)>Number(a.refunded_cents)||Number(v.net_cents)<Number(a.net_cents)||v.charge_id!==a.charge_id||v.payment_intent_id!==a.payment_intent_id) blocked.add(String(b.shop_id));
 }
 return blocked;
}
export async function getPayoutDashboard():Promise<PayoutDashboard> {
 const state=await load(createAdminClient()); const review=shopReviewSet(state); const reasons=new Map<string,number>();
 let eligibleCents=0,eligibleOrderCount=0,blockedOrderCount=0;
 for(const raw of state.orders) {
  if(raw.status!=="paid"&&raw.status!=="refunded")continue;
  // Free and simulated purchases never create a seller money obligation.
  if(raw.mock||raw.payment_method!=="stripe"||Number(raw.price_cents)<=0)continue;
  if(state.allocations.some(a=>a.order_id===raw.id&&!a.released_at))continue;
  const v=state.observations.find(x=>x.order_id===raw.id),shop=state.shops.find(x=>x.id===raw.shop_id),profile=state.profiles.find(x=>x.shop_id===raw.shop_id);
  let reason=!v?"ยังไม่ได้ตรวจสอบกับ Stripe":!isFresh(v.checked_at)?"ต้องตรวจสอบ Stripe ใหม่":!v.eligible?(REASON_LABELS[String(v.reason)]||String(v.reason)):"";
  if(!reason&&(raw.mock||raw.status!=="paid"||raw.payment_method!=="stripe"||Number(raw.price_cents)<=0))reason="ไม่ใช่คำสั่งซื้อที่ชำระเงินจริง";
  if(!reason&&state.controls.some(c=>c.user_id===shop?.owner_id&&c.payout_hold))reason="ผู้ขายถูกพักการจ่ายเงิน";
  if(!reason&&review.has(String(raw.shop_id)))reason="ยอดที่เคยจ่ายต้องตรวจสอบเงินคืนหรือข้อพิพาท";
  if(!reason&&!validateRecipient(profile||null).valid)reason="ข้อมูลผู้รับไม่ครบหรือชื่อบัญชีไม่ตรง";
  if(reason) {blockedOrderCount++;reasons.set(reason,(reasons.get(reason)||0)+1);} else {eligibleCents+=Number(v!.net_cents);eligibleOrderCount++;}
 }
 const batches:PayoutBatchSummary[]=state.batches.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).map(b=>{
  const snapshot=b.recipient_snapshot as Row; const destination=String(snapshot.accountNumber||snapshot.promptpayId||"");
  return {completionWarning:b.completion_review_required?"บันทึกการโอนจริงแล้ว แต่ข้อมูลหรือยอดปัจจุบันเปลี่ยน ต้องตรวจสอบก่อนจ่ายเพิ่ม":null,hasSlip:state.slips.some(s=>s.batch_id===b.id),id:String(b.id),shopId:String(b.shop_id),shopName:String(state.shops.find(s=>s.id===b.shop_id)?.name||"ร้านค้า"),amountCents:Number(b.amount_cents),orderCount:state.allocations.filter(a=>a.batch_id===b.id).length,status:b.status as PayoutBatchSummary["status"],recipientName:String(snapshot.recipientName),destinationMasked:`${snapshot.bankCode||"PromptPay"} •••• ${destination.slice(-4)}`,createdAt:String(b.created_at),paidAt:b.paid_at as string|null,transferReference:b.transfer_reference as string|null};
 });
 return {mode:"manual",scheduleEnabled:state.settings[0]?.schedule_enabled===true,providerReady:false,providerReason:PROVIDER_REASON,scheduleLabel:"ทุกวันจันทร์ 10:00 น. (เวลาไทย) — เตรียมชุดให้ตรวจสอบเท่านั้น",lastReconciledAt:state.settings[0]?.last_reconciled_at as string|null,eligibleCents,eligibleOrderCount,blockedOrderCount,blockedReasons:[...reasons].map(([reason,count])=>({reason,count})),batches};
}
const REASON_LABELS:Record<string,string>={
 not_real_paid_order:"ไม่ใช่คำสั่งซื้อที่ชำระเงินจริง",payment_mismatch_or_not_live:"ข้อมูลรับชำระไม่ตรงหรือไม่ใช่โหมดเงินจริง",
 charge_mismatch:"ข้อมูลรายการเรียกเก็บเงินไม่ตรง",disputed_or_unknown:"มีข้อพิพาทหรือยังยืนยันไม่ได้",funds_not_available:"ยอด Stripe ยังไม่พร้อมใช้หรือยังตรวจสอบยอดไม่ได้",
 seven_day_hold:"ยังไม่ครบระยะพักเงิน 7 วัน",refund_mismatch:"ข้อมูลการคืนเงินไม่ตรง",refund_pending_or_unknown:"มีรายการคืนเงินที่รอดำเนินการ",
 refund_total_mismatch:"ยอดคืนเงินยังตรวจสอบไม่ตรงกัน",fully_refunded:"คืนเงินเต็มจำนวนแล้ว",local_refunded_order_requires_review:"คำสั่งซื้อคืนเงินแล้ว ต้องตรวจสอบ",
 checkout_reference_mismatch:"หมายเลขอ้างอิงการรับชำระไม่ตรง",unverified:"ยังตรวจสอบการรับชำระไม่ได้",
};
const EMPTY:Assessment={eligible:false,reason:"unverified",netCents:0,refundedCents:0,chargeId:null,balanceTransactionId:null};
export async function reconcilePayouts(actorId?:string):Promise<PayoutDashboard> {
 const db=createAdminClient();
 // Refunded orders remain included so refunds AFTER a previous manual payout block further payouts.
 const allOrders=(await rows(db,"orders","id,shop_id,status,mock,price_cents,payment_method,stripe_payment_intent_id,paid_at")).filter(o=>o.payment_method==="stripe"&&!o.mock&&Number(o.price_cents)>0) as PayoutOrder[];
 const previous=await rows(db,"seller_payout_observations","order_id,checked_at");
 const checkedByOrder=new Map(previous.map(v=>[String(v.order_id),Date.parse(String(v.checked_at))||0]));
 const checked=(id:string)=>checkedByOrder.get(id)||0;
 // Oldest evidence first makes repeated bounded passes advance across the ledger.
 // Unprocessed records stay untouched/stale and therefore fail the SQL freshness gate.
 const orders=[...allOrders].sort((a,b)=>checked(a.id)-checked(b.id)||a.id.localeCompare(b.id)).slice(0,200);
 const {data:contextData,error:contextError}=orders.length?await db.from("stripe_checkout_contexts").select("order_id,shop_id,amount_cents,stripe_payment_intent_id,status,checkout_reference").in("order_id",orders.map(o=>o.id)):{data:[],error:null};fail(contextError);
 const contexts=(contextData||[]) as Row[];
 const counts=new Map<string|null,number>();for(const o of allOrders)counts.set(o.stripe_payment_intent_id,(counts.get(o.stripe_payment_intent_id)||0)+1);
 const duplicateIntents=new Set([...counts].filter(([,count])=>count>1).map(([id])=>id));
 const deadline=Date.now()+180000; let index=0;
 await Promise.all(Array.from({length:Math.min(5,orders.length)},async()=>{
  while(index<orders.length && Date.now()<=deadline) {
   const order=orders[index++]; const observedAt=new Date().toISOString(); let result:Assessment={...EMPTY};
   const context=contexts.find(c=>c.order_id===order.id&&c.shop_id===order.shop_id&&c.stripe_payment_intent_id===order.stripe_payment_intent_id&&c.status==="completed"&&c.amount_cents===order.price_cents);
   if(!context||duplicateIntents.has(order.stripe_payment_intent_id))result.reason="ข้อมูลคำสั่งซื้อไม่ตรงกับรายการรับชำระ";
   else if(order.stripe_payment_intent_id) {
    try {
     const {payment,refunds}=await readStripePayment(getStripe(),order.stripe_payment_intent_id);
     const reference=(payment as {metadata?:{checkout_reference?:string}}).metadata?.checkout_reference;
     result=reference&&reference!==context.checkout_reference?{...EMPTY,reason:"checkout_reference_mismatch"}:assessPayment({...order,status:order.status==="refunded"?"paid":order.status},payment,refunds);
     if(order.status==="refunded"&&result.eligible)result={...result,eligible:false,reason:"local_refunded_order_requires_review"};
    } catch {result={...EMPTY,reason:"ตรวจสอบ Stripe ไม่สำเร็จ: ตรวจสอบสิทธิ์อ่าน PaymentIntent, Charge, BalanceTransaction และ Refund แล้วลองใหม่"};}
   }
   await rpc(db,"record_seller_payout_observation",{p_observation:{order_id:order.id,payment_intent_id:order.stripe_payment_intent_id,charge_id:result.chargeId,balance_transaction_id:result.balanceTransactionId,eligible:result.eligible,reason:result.reason,gross_cents:order.price_cents,refunded_cents:result.refundedCents,net_cents:result.netCents,checked_at:observedAt}});
  }
 }));
 const {error:settingsError}=await db.from("seller_payout_settings").update({last_reconciled_at:new Date().toISOString()}).eq("singleton",true);fail(settingsError);
 await rpc(db,"review_seller_payout_batches");
 const {error:auditError}=await db.from("seller_payout_events").insert({actor_id:actorId||null,action:"stripe_reconciliation_finished"});fail(auditError);
 return getPayoutDashboard();
}
export async function preparePayoutBatch(actorId:string|null,requestId:string):Promise<{batchIds:string[]}> {
 if(!/^[a-zA-Z0-9:_-]{1,150}$/.test(requestId))throw new PayoutError("รหัสคำขอไม่ถูกต้อง");
 await reconcilePayouts(actorId||undefined);const db=createAdminClient();const state=await load(db);const blocked=shopReviewSet(state);const batchIds:string[]=[];
 for(const shop of state.shops) {
  const existing=state.batches.find(b=>b.request_key===`${requestId}:${shop.id}`);
  if(existing){batchIds.push(String(existing.id));continue;}
  if(blocked.has(String(shop.id))||state.controls.some(c=>c.user_id===shop.owner_id&&c.payout_hold)||!validateRecipient(state.profiles.find(p=>p.shop_id===shop.id)||null).valid)continue;
  const batch=await rpc(db,"prepare_seller_payout_batch",{p_actor:actorId,p_request:requestId,p_shop:shop.id});if(batch)batchIds.push(String(batch));
 }
 return {batchIds};
}
export async function cancelPayoutBatch(actorId:string,batchId:string) {await rpc(createAdminClient(),"cancel_seller_payout_batch",{p_actor:actorId,p_batch:batchId});}
export async function completeManualPayout(actorId:string,batchId:string,reference:string,paidAt:string) {
 if(!reference?.trim()||reference.trim().length<6||reference.trim().length>150||!Number.isFinite(Date.parse(paidAt)))throw new PayoutError("กรอกเลขอ้างอิงและวันเวลาที่โอนเงินจริงให้ครบถ้วน");
 await rpc(createAdminClient(),"complete_manual_seller_payout",{p_actor:actorId,p_batch:batchId,p_reference:reference,p_paid_at:new Date(paidAt).toISOString()});
}
export async function setPayoutMode(actorId:string,mode:PayoutMode,scheduleEnabled=false) {
 if(mode!=="manual")throw new PayoutError(PROVIDER_REASON);
 await rpc(createAdminClient(),"configure_seller_payouts",{p_actor:actorId,p_mode:mode,p_schedule:scheduleEnabled});
}
export async function getPayoutBatchInstructions(batchId:string):Promise<PayoutInstructions> {
 await reconcilePayouts();const db=createAdminClient();
 const {data:batch,error}=await db.from("seller_payout_batches").select("id,shop_id,status,amount_cents,recipient_snapshot").eq("id",batchId).single();fail(error);
 if(!batch||batch.status!=="ready")throw new PayoutError("ชุดจ่ายเงินไม่พร้อมหรือข้อมูลผู้รับเปลี่ยน กรุณาตรวจสอบก่อนโอน");
 const {data:shop,error:shopError}=await db.from("shops").select("name").eq("id",batch.shop_id).single();fail(shopError);
 return {batchId,shopName:shop?.name||"ร้านค้า",amountCents:Number(batch.amount_cents),...batch.recipient_snapshot,warning:"ตรวจสอบชื่อผู้รับในแอปธนาคารให้ตรงกับชื่อที่แสดงก่อนโอน โอนยอดนี้เพียงครั้งเดียว แล้วบันทึกเลขอ้างอิงและเวลาจริง ระบบไม่ได้โอนเงินให้อัตโนมัติ"};
}

/** Immutable original instructions for recording a transfer ALREADY made.
 * This deliberately does not re-authorize sending another transfer. */
export async function getManualPayoutRecord(batchId:string):Promise<PayoutInstructions> {
 const db=createAdminClient();
 const {data:batch,error}=await db.from("seller_payout_batches").select("id,shop_id,status,amount_cents,recipient_snapshot").eq("id",batchId).single();fail(error);
 if(!batch||batch.status==="cancelled")throw new PayoutError("ไม่พบชุดจ่ายเงินที่บันทึกการโอนได้");
 const {data:shop,error:shopError}=await db.from("shops").select("name").eq("id",batch.shop_id).single();fail(shopError);
 return {batchId,shopName:shop?.name||"ร้านค้า",amountCents:Number(batch.amount_cents),...batch.recipient_snapshot,warning:"ข้อมูลผู้รับเดิมสำหรับบันทึกเงินที่โอนแล้วเท่านั้น อย่าโอนซ้ำ หากยังไม่ได้โอนให้เปิดคำแนะนำการโอนเพื่อตรวจสอบใหม่ก่อน"};
}
