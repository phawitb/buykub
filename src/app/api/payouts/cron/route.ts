import { timingSafeEqual } from "node:crypto";
import { getPayoutDashboard, preparePayoutBatch } from "@/lib/payouts/service";
import { mondayRunKey } from "@/lib/payouts/eligibility";
export const runtime="nodejs";
export const maxDuration=300;
const headers={"Cache-Control":"private, no-store"};
export async function GET(request:Request) {
 const configured=process.env.CRON_SECRET;
 const expected=Buffer.from(`Bearer ${configured||""}`);const actual=Buffer.from(request.headers.get("authorization")||"");
 if(!configured||actual.length!==expected.length||!timingSafeEqual(actual,expected))return Response.json({error:"Unauthorized"},{status:401,headers});
 const runKey=mondayRunKey(new Date());
 if(!runKey)return Response.json({status:"outside_schedule"},{headers});
 try {
  const dashboard=await getPayoutDashboard();
  if(!dashboard.scheduleEnabled)return Response.json({status:"schedule_disabled"},{headers});
  const result=await preparePayoutBatch(null,runKey);
  return Response.json({status:"prepared_for_review",batchCount:result.batchIds.length,moneyTransferred:false},{headers});
 }catch{return Response.json({error:"Payout review preparation failed. No automatic bank transfer was made; inspect admin reconciliation."},{status:503,headers});}
}
