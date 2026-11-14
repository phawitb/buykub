import { isReceiptId } from "@/lib/payments/receipt";
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (!isReceiptId(sessionId)) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 400, headers });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Downloads are not configured' }, { status: 503, headers });
  try {
    const response = await fetch(`${url}/functions/v1/download-product`, {
      method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }), cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok) return NextResponse.json({ error: result.error || 'ไม่สามารถดาวน์โหลดได้' }, { status: response.status, headers });
    const signedUrl = new URL(result.url);
    if (signedUrl.origin !== new URL(url).origin || !signedUrl.pathname.startsWith('/storage/v1/object/sign/product-files/')) throw new Error('Invalid download destination');
    return new NextResponse(null, { status: 303, headers: { ...headers, Location: signedUrl.toString() } });
  } catch {
    return NextResponse.json({ error: 'เตรียมดาวน์โหลดไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 503, headers });
  }
}
