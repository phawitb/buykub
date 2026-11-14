import { AdminAccessError, getAdminContext } from "@/lib/admin/access";
import { ADMIN_RESPONSE_HEADERS, AdminInputError, assertSameOrigin } from "@/lib/admin/validation";
import { payoutId } from "@/lib/admin/payout-actions";
import { getPayoutSlipUrl, uploadPayoutSlip } from "@/lib/payouts/slips";
import { PayoutError } from "@/lib/payouts/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 4 * 1024 * 1024 + 16384;
function failure(error: unknown) {
  const status = error instanceof AdminAccessError || error instanceof AdminInputError ? error.status : error instanceof PayoutError ? 409 : 503;
  return Response.json({ error: status === 503 ? "ไม่สามารถเปิดหรือบันทึกสลิปได้ กรุณาลองอีกครั้ง" : error instanceof Error ? error.message : "ไม่สามารถดำเนินการได้" }, { status, headers: ADMIN_RESPONSE_HEADERS });
}
async function readUpload(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) throw new AdminInputError("กรุณาแนบไฟล์สลิป", 415);
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new AdminInputError("ไฟล์ต้องมีขนาดไม่เกิน 4 MB", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AdminInputError("ไม่พบไฟล์สลิป");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new AdminInputError("ไฟล์ต้องมีขนาดไม่เกิน 4 MB", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return await new Response(bytes, { headers: { "content-type": contentType } }).formData(); }
  catch { throw new AdminInputError("ข้อมูลไฟล์ไม่ถูกต้อง"); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { user } = await getAdminContext();
    const form = await readUpload(request);
    const batchId = payoutId(form.get("batchId"));
    const file = form.get("file");
    if (!file || typeof file === "string" || form.getAll("file").length !== 1 || form.getAll("batchId").length !== 1) throw new AdminInputError("กรุณาแนบสลิปหนึ่งไฟล์");
    return Response.json(await uploadPayoutSlip(user.id, batchId, file), { headers: ADMIN_RESPONSE_HEADERS });
  } catch (error) { return failure(error); }
}
export async function GET(request: Request) {
  try {
    await getAdminContext();
    return Response.json(await getPayoutSlipUrl(payoutId(new URL(request.url).searchParams.get("batchId"))), { headers: ADMIN_RESPONSE_HEADERS });
  } catch (error) { return failure(error); }
}
