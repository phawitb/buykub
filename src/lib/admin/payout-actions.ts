import "server-only";
import { getAdminContext } from "./access";
import { AdminInputError } from "./validation";
import { cancelAffiliatePayout, completeAffiliatePayout, getAffiliatePayoutInstructions, prepareAffiliatePayout } from "@/lib/affiliates/payouts";
import { cancelPayoutBatch, completeManualPayout, getManualPayoutRecord, getPayoutBatchInstructions, preparePayoutBatch, reconcilePayouts } from "@/lib/payouts/service";

export function payoutId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new AdminInputError("ไม่พบรายการจ่ายเงินที่ถูกต้อง");
  return value;
}
function transferProof(body: Record<string, unknown>) {
  if (body.confirmed !== true || !Number.isSafeInteger(body.amountCents) || Number(body.amountCents) <= 0) throw new AdminInputError("กรุณายืนยันว่าโอนเงินจริงครบตามยอดแล้ว");
  if (typeof body.reference !== "string" || body.reference.trim().length < 6 || body.reference.length > 150 || /[\u0000-\u001f\u007f]/.test(body.reference)) throw new AdminInputError("กรอกเลขอ้างอิงธนาคารจริงอย่างน้อย 6 ตัว");
  if (typeof body.paidAt !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.paidAt) || !Number.isFinite(Date.parse(body.paidAt)) || Date.parse(body.paidAt) > Date.now()) throw new AdminInputError("กรอกวันเวลาที่โอนจริงให้ถูกต้อง");
  return { reference: body.reference.trim(), paidAt: new Date(body.paidAt).toISOString() };
}
export async function applyPayoutAction(action: string, raw: unknown): Promise<Record<string, unknown>> {
  const { user } = await getAdminContext();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AdminInputError("ข้อมูลไม่ถูกต้อง");
  const body = raw as Record<string, unknown>;
  if (action === "payout-affiliate-prepare") return prepareAffiliatePayout(user.id, payoutId(body.requestId), payoutId(body.userId));
  if (action === "payout-affiliate-instructions") return { instructions: await getAffiliatePayoutInstructions(payoutId(body.batchId)) };
  if (action === "payout-affiliate-cancel") {
    if (body.confirmedNotTransferred !== true) throw new AdminInputError("กรุณายืนยันว่ารายการนี้ยังไม่ได้โอนเงินจริง");
    await cancelAffiliatePayout(user.id, payoutId(body.batchId)); return { ok: true };
  }
  if (action === "payout-affiliate-complete") {
    const batchId = payoutId(body.batchId);
    const { reference, paidAt } = transferProof(body);
    const instructions = await getAffiliatePayoutInstructions(batchId);
    if (instructions.amountCents !== body.amountCents) throw new AdminInputError("ยอดไม่ตรงกับรายการโอน กรุณาเปิดรายการใหม่", 409);
    await completeAffiliatePayout(user.id, batchId, reference, paidAt);
    return { ok: true };
  }
  if (action === "payout-reconcile") { await reconcilePayouts(user.id); return { ok: true }; }
  if (action === "payout-prepare") return preparePayoutBatch(user.id, payoutId(body.requestId));
  if (action === "payout-cancel") {
    if (body.confirmedNotTransferred !== true) throw new AdminInputError("กรุณายืนยันว่ารายการนี้ยังไม่ได้โอนเงินจริง");
    await cancelPayoutBatch(user.id, payoutId(body.batchId)); return { ok: true };
  }
  if (action === "payout-instructions") return { instructions: await getPayoutBatchInstructions(payoutId(body.batchId)) };
  if (action === "payout-record") return { instructions: await getManualPayoutRecord(payoutId(body.batchId)) };
  if (action === "payout-complete") {
    const batchId = payoutId(body.batchId);
    const { reference, paidAt } = transferProof(body);
    const instructions = await getManualPayoutRecord(batchId);
    if (instructions.amountCents !== body.amountCents) throw new AdminInputError("ยอดไม่ตรงกับรายการจ่ายเงิน กรุณาเปิดรายการใหม่", 409);
    await completeManualPayout(user.id, batchId, reference, paidAt);
    return { ok: true };
  }
  throw new AdminInputError("ไม่รองรับคำสั่งนี้", 404);
}
