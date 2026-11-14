import { expect, it } from "vitest";
import { readStripePayment } from "./stripe-reconcile";
it("reads all refund pages and does not mistake the first ten for the authoritative total", async()=>{
 const pages=[{data:[{id:"r1"}],has_more:true},{data:[{id:"r2"}],has_more:false}]; const calls:unknown[]=[];
 const gateway={paymentIntents:{retrieve:async()=>({latest_charge:{id:"ch_1"}})},refunds:{list:async(args:unknown)=>{calls.push(args);return pages.shift()!;}}};
 const result=await readStripePayment(gateway,"pi_1");expect(result.refunds).toEqual([{id:"r1"},{id:"r2"}]);expect(calls[1]).toMatchObject({starting_after:"r1",charge:"ch_1"});
});
it("fails closed on an unreadable or broken page", async()=>{ const gateway={paymentIntents:{retrieve:async()=>({latest_charge:{id:"ch_1"}})},refunds:{list:async()=>({data:[],has_more:true})}};await expect(readStripePayment(gateway,"pi_1")).rejects.toThrow(); });
