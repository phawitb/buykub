import { isReceiptId } from "@/lib/payments/receipt";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!isReceiptId(sessionId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "public" },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await supabase.rpc("get_stripe_checkout_success", {
    p_stripe_session_id: sessionId,
  });
  if (error || !Array.isArray(data) || !data[0]) {
    return NextResponse.json({ error: "Checkout not found" }, { status: 404 });
  }
  const { data: course, error: courseError } = await supabase.rpc("get_checkout_course", { p_receipt_id: sessionId });
  if (courseError) return NextResponse.json({ error: "Checkout details unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ...data[0], ...(course ?? {}) }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
