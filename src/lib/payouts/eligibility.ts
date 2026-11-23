import { validatePayoutIdentity, type PayoutIdentity } from "@/app/dashboard/settings/payout-profile";
import { parseBankDetails, getThaiBank } from "@/app/dashboard/settings/thai-banks";
import { saleSplit } from "./split";

export type PayoutOrder = { id:string; shop_id:string; status:string; mock:boolean; price_cents:number; payment_method:string|null; stripe_payment_intent_id:string|null; paid_at:string|null };
type RecordValue = Record<string, unknown>;
function record(value:unknown):RecordValue { return value && typeof value === "object" ? value as RecordValue : {}; }
function objectId(value:unknown):unknown { return typeof value === "string" ? value : record(value).id; }
function cents(value:unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
export type Assessment = { eligible:boolean; reason:string; netCents:number; refundedCents:number; chargeId:string|null; balanceTransactionId:string|null };
// Five percent commission is rounded half up to a satang for EACH order,
// after successful refunds are subtracted. No floating-point currency math.
// A referral commission is withheld too, matching prepare_seller_payout_batch.
export function payoutAmount(gross:number, refunded:number, referralRateBp=0):number {
  if(!cents(gross)||!cents(refunded)||refunded>gross) return 0;
  return saleSplit(gross-refunded,referralRateBp).shopCents;
}
export function assessPayment(order:PayoutOrder, rawPayment:unknown, rawRefunds:unknown[], now=Date.now()):Assessment {
  const result:Assessment={eligible:false,reason:"unverified_payment",netCents:0,refundedCents:0,chargeId:null,balanceTransactionId:null};
  const reject=(reason:string)=>({...result,reason});
  if(order.mock || order.status!=="paid" || order.payment_method!=="stripe" || !order.stripe_payment_intent_id || !cents(order.price_cents)||order.price_cents===0) return reject("not_real_paid_order");
  const pi=record(rawPayment), ch=record(pi.latest_charge), tx=record(ch.balance_transaction);
  if(pi.id!==order.stripe_payment_intent_id || pi.status!=="succeeded" || pi.livemode!==true || pi.currency!=="thb" || pi.amount!==order.price_cents || pi.amount_received!==order.price_cents) return reject("payment_mismatch_or_not_live");
  if(typeof ch.id!=="string" || objectId(ch.payment_intent)!==pi.id || ch.status!=="succeeded" || ch.paid!==true || ch.captured!==true || ch.livemode!==true || ch.currency!=="thb" || ch.amount!==order.price_cents) return reject("charge_mismatch");
  result.chargeId=ch.id;
  if(ch.disputed!==false) return reject("disputed_or_unknown");
  if(typeof tx.id!=="string" || tx.status!=="available" || tx.currency!=="thb" || tx.amount!==order.price_cents || objectId(tx.source)!==ch.id || typeof tx.available_on!=="number" || tx.available_on*1000>now) return reject("funds_not_available");
  result.balanceTransactionId=tx.id;
  const paidAt=Date.parse(order.paid_at||"");
  if(!Number.isFinite(paidAt)||typeof ch.created!=="number"||Math.max(paidAt,ch.created*1000)+7*86400000>now) return reject("seven_day_hold");
  let refunded=0; const seen=new Set<string>();
  for(const raw of rawRefunds) {
    const refund=record(raw);
    if(typeof refund.id!=="string"||seen.has(refund.id)||objectId(refund.charge)!==ch.id||objectId(refund.payment_intent)!==pi.id||refund.currency!=="thb"||!cents(refund.amount)) return reject("refund_mismatch");
    seen.add(refund.id);
    if(refund.status==="succeeded") refunded+=refund.amount;
    else if(refund.status!=="failed"&&refund.status!=="canceled") return reject("refund_pending_or_unknown");
  }
  result.refundedCents=refunded;
  if(!cents(ch.amount_refunded)||ch.amount_refunded!==refunded||refunded>order.price_cents) return reject("refund_total_mismatch");
  result.netCents=payoutAmount(order.price_cents,refunded);
  if(result.netCents<=0) return reject("fully_refunded");
  return {...result,eligible:true,reason:"eligible"};
}
export function validateRecipient(profile:RecordValue|null):{valid:boolean;reason:string} {
  if(!profile) return {valid:false,reason:"missing_payout_profile"};
  const fields=["full_name_th","contact_phone","national_id","address_line","subdistrict","district","province","postal_code"];
  if(fields.some(key=>typeof profile[key]!=="string") || Object.keys(validatePayoutIdentity(profile as PayoutIdentity)).length) return {valid:false,reason:"incomplete_payout_profile"};
  if(profile.payout_method==="bank") {
    const bank=parseBankDetails(profile.bank_details as string|null);
    const normalize=(value:string)=>value.normalize("NFC").trim().replace(/\s+/g," ");
    if(!getThaiBank(bank.bankCode)||!/^\d{6,16}$/.test(bank.accountNumber)||normalize(bank.accountName)!==normalize(profile.full_name_th as string)) return {valid:false,reason:"bank_name_or_account_invalid"};
  } else if(profile.payout_method!=="promptpay"||typeof profile.promptpay_id!=="string"||!/^([0-9]{10}|[0-9]{13})$/.test(profile.promptpay_id)) return {valid:false,reason:"payout_destination_invalid"};
  return {valid:true,reason:"ready"};
}
export function mondayRunKey(date:Date):string|null {
  // Bangkok is UTC+7 year-round. Allow retries during Monday after 10:00.
  const local=new Date(date.getTime()+7*3600000);
  return local.getUTCDay()===1 && local.getUTCHours()>=10 ? `monday:${local.toISOString().slice(0,10)}` : null;
}
