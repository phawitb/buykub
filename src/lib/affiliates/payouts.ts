import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { PayoutError } from "@/lib/payouts/errors";
import { MAX_SLIP_BYTES, validateSlip } from "@/lib/payouts/slips";

// Affiliate slips share the private seller slip bucket under their own prefix.
const BUCKET = "seller-payout-slips";

export type AffiliateRecipient = { recipientName: string; method: "promptpay" | "bank"; bankCode: string | null; accountNumber: string | null; promptpayId: string | null };
export type AffiliatePayable = { userId: string; amountCents: number; commissionCount: number; recipientName: string | null; destinationMasked: string | null };
export type AffiliateBatch = { id: string; userId: string; status: "ready" | "completed" | "cancelled"; amountCents: number; recipientName: string; destinationMasked: string; createdAt: string; paidAt: string | null; transferReference: string | null; reviewRequired: boolean; hasSlip: boolean };
export type AffiliatePayoutDashboard = { payables: AffiliatePayable[]; pendingCents: number; batches: AffiliateBatch[] };

const mask = (value: string | null | undefined) => value ? `•••${value.slice(-4)}` : "";
function destination(snapshot: Partial<AffiliateRecipient>) {
  return snapshot.method === "bank" ? `${snapshot.bankCode?.toUpperCase() || "ธนาคาร"} ${mask(snapshot.accountNumber)}` : `พร้อมเพย์ ${mask(snapshot.promptpayId)}`;
}

const messages: Record<string, string> = {
  payout_profile_incomplete_or_name_mismatch: "ผู้แนะนำยังกรอกข้อมูลรับเงินไม่ครบ หรือชื่อบัญชีไม่ตรง",
  affiliate_payout_hold: "บัญชีนี้ถูกพักการจ่ายเงินไว้",
  payout_slip_required: "แนบสลิปก่อนบันทึกการโอน",
  batch_not_ready: "รายการนี้ไม่อยู่ในสถานะรอโอน",
  slip_attached_possible_transfer_do_not_cancel: "มีสลิปแล้ว อาจโอนไปแล้ว ห้ามยกเลิก",
  cannot_cancel_completed_payout: "รายการที่โอนแล้วยกเลิกไม่ได้",
  completed_slip_immutable: "สลิปของรายการที่บันทึกโอนแล้วเปลี่ยนไม่ได้",
  invalid_real_bank_reference_or_date: "เลขอ้างอิงหรือวันเวลาที่โอนไม่ถูกต้อง",
};
function fail(error: { message: string }, fallback: string): never {
  const key = Object.keys(messages).find(code => error.message.includes(code));
  throw new PayoutError(key ? messages[key] : fallback);
}

export async function getAffiliatePayoutDashboard(): Promise<AffiliatePayoutDashboard> {
  const db = createAdminClient();
  const [commissions, batches] = await Promise.all([
    db.from("affiliate_commissions").select("affiliate_user_id, amount_cents, status, batch_id").in("status", ["pending", "payable"]).limit(5000),
    db.from("affiliate_payout_batches").select("id, user_id, status, amount_cents, recipient_snapshot, created_at, paid_at, transfer_reference, completion_review_required, affiliate_payout_slips(batch_id)")
      .neq("status", "cancelled").order("created_at", { ascending: false }).limit(100),
  ]);
  if (commissions.error) throw commissions.error;
  if (batches.error) throw batches.error;
  const totals = new Map<string, { amountCents: number; commissionCount: number }>();
  let pendingCents = 0;
  for (const row of commissions.data ?? []) {
    if (row.status === "pending") { pendingCents += Number(row.amount_cents); continue; }
    if (row.batch_id || Number(row.amount_cents) <= 0) continue;
    const total = totals.get(row.affiliate_user_id) ?? { amountCents: 0, commissionCount: 0 };
    total.amountCents += Number(row.amount_cents); total.commissionCount += 1;
    totals.set(row.affiliate_user_id, total);
  }
  const { data: profiles } = totals.size
    ? await db.from("affiliate_payout_profiles").select("user_id, full_name_th, payout_method, promptpay_id, bank_details").in("user_id", [...totals.keys()])
    : { data: [] };
  const profileByUser = new Map((profiles ?? []).map(profile => [profile.user_id, profile]));
  const payables = [...totals].map(([userId, total]) => {
    const profile = profileByUser.get(userId);
    let bank: { bankCode?: string; accountNumber?: string } = {};
    try { bank = profile?.bank_details ? JSON.parse(profile.bank_details) : {}; } catch { /* shown as incomplete */ }
    return { userId, ...total, recipientName: profile?.full_name_th || null,
      destinationMasked: profile ? destination({ method: profile.payout_method, bankCode: bank.bankCode ?? null, accountNumber: bank.accountNumber ?? null, promptpayId: profile.promptpay_id }) : null };
  }).sort((a, b) => b.amountCents - a.amountCents);
  return {
    payables, pendingCents,
    batches: (batches.data ?? []).map(row => {
      const snapshot = row.recipient_snapshot as Partial<AffiliateRecipient>;
      const slips = row.affiliate_payout_slips as unknown;
      return { id: row.id, userId: row.user_id, status: row.status, amountCents: Number(row.amount_cents), recipientName: snapshot.recipientName || "", destinationMasked: destination(snapshot),
        createdAt: row.created_at, paidAt: row.paid_at, transferReference: row.transfer_reference, reviewRequired: row.completion_review_required,
        hasSlip: Array.isArray(slips) ? slips.length > 0 : Boolean(slips) };
    }),
  };
}

export async function prepareAffiliatePayout(actorId: string, requestId: string, userId: string) {
  const { data, error } = await createAdminClient().rpc("prepare_affiliate_payout_batch", { p_actor: actorId, p_request: requestId, p_user: userId });
  if (error) fail(error, "เตรียมรายการไม่สำเร็จ กรุณาลองใหม่");
  return { batchId: typeof data === "string" ? data : null };
}

export async function getAffiliatePayoutInstructions(batchId: string): Promise<AffiliateRecipient & { batchId: string; amountCents: number }> {
  const { data, error } = await createAdminClient().from("affiliate_payout_batches").select("id, amount_cents, recipient_snapshot").eq("id", batchId).maybeSingle();
  if (error || !data) throw new PayoutError("ไม่พบรายการโอนค่าคอม");
  const snapshot = data.recipient_snapshot as AffiliateRecipient;
  return { batchId: data.id, amountCents: Number(data.amount_cents), recipientName: snapshot.recipientName, method: snapshot.method,
    bankCode: snapshot.bankCode ?? null, accountNumber: snapshot.accountNumber ?? null, promptpayId: snapshot.promptpayId ?? null };
}

export async function cancelAffiliatePayout(actorId: string, batchId: string) {
  const { error } = await createAdminClient().rpc("cancel_affiliate_payout_batch", { p_actor: actorId, p_batch: batchId });
  if (error) fail(error, "ยกเลิกรายการไม่สำเร็จ");
}

export async function completeAffiliatePayout(actorId: string, batchId: string, reference: string, paidAt: string) {
  const { error } = await createAdminClient().rpc("complete_manual_affiliate_payout", { p_actor: actorId, p_batch: batchId, p_reference: reference, p_paid_at: paidAt });
  if (error) fail(error, "บันทึกการโอนไม่สำเร็จ");
}

export async function uploadAffiliatePayoutSlip(actorId: string, batchId: string, file: File): Promise<{ attached: true }> {
  if (file.size > MAX_SLIP_BYTES) throw new PayoutError("สลิปต้องมีขนาดไม่เกิน 4 MB");
  const content = new Uint8Array(await file.arrayBuffer());
  const extension = validateSlip(file.type, content, file.size);
  const db = createAdminClient();
  const path = `affiliate/${batchId}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, content, { contentType: file.type, upsert: false, cacheControl: "0" });
  if (uploadError) throw new PayoutError("อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่");
  const { data: previous, error } = await db.rpc("attach_affiliate_payout_slip", { p_actor: actorId, p_batch: batchId, p_path: path, p_mime: file.type, p_size: file.size });
  // As with shop slips, keep the new object on error: the attachment may have committed.
  if (error) fail(error, "แนบสลิปไม่ได้ กรุณาตรวจสอบสถานะรายการและลองใหม่");
  if (typeof previous === "string" && previous !== path) await db.storage.from(BUCKET).remove([previous]);
  return { attached: true };
}

export async function getAffiliatePayoutSlipUrl(batchId: string): Promise<{ url: string }> {
  const db = createAdminClient();
  const { data, error } = await db.from("affiliate_payout_slips").select("object_path").eq("batch_id", batchId).single();
  if (error || !data) throw new PayoutError("ไม่พบสลิปของรายการนี้");
  const { data: link, error: linkError } = await db.storage.from(BUCKET).createSignedUrl(data.object_path, 60, { download: true });
  if (linkError || !link) throw new PayoutError("ไม่สามารถเปิดสลิปได้ กรุณาลองใหม่");
  return { url: link.signedUrl };
}
