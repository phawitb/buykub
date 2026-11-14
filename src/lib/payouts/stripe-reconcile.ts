import "server-only";
type RefundPage={data:{id:string}[];has_more:boolean};
export type StripeReader={
 paymentIntents:{retrieve:(id:string,params:{expand:string[]})=>Promise<unknown>};
 refunds:{list:(params:{charge:string;limit:number;starting_after?:string})=>Promise<RefundPage>};
};
export async function readStripePayment(stripe:StripeReader,paymentIntentId:string) {
 const payment=await stripe.paymentIntents.retrieve(paymentIntentId,{expand:["latest_charge.balance_transaction"]});
 const charge=(payment as {latest_charge?:{id?:string}|string}).latest_charge;
 if(!charge||typeof charge==="string"||!charge.id) throw new Error("charge_not_expanded");
 const refunds:unknown[]=[]; let cursor:string|undefined;
 for(let page=0;page<20;page++) {
  const result=await stripe.refunds.list({charge:charge.id,limit:100,...(cursor?{starting_after:cursor}:{})});
  refunds.push(...result.data);
  if(!result.has_more) return {payment,refunds};
  const next=result.data.at(-1)?.id;
  if(!next||next===cursor) throw new Error("refund_pagination_incomplete");
  cursor=next;
 }
 throw new Error("refund_history_requires_manual_review");
}
