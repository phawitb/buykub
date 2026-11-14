import { NextResponse } from "next/server";
import { cleanupExpiredPromptpay } from "@/lib/payments/promptpay";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await cleanupExpiredPromptpay(); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: "Cleanup unavailable" }, { status: 503 }); }
}
