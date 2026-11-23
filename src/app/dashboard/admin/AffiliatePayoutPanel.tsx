"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getThaiBank } from '@/app/dashboard/settings/thai-banks';
import type { AffiliateBatch, AffiliatePayoutDashboard, AffiliateRecipient } from '@/lib/affiliates/payouts';
import { Badge, baht, buttonClass, cardClass, ConfirmDialog, dateLabel, EmptyState, Feedback, inputClass, postAdmin, primaryClass, useAdminAction } from './AdminControls';

type Instructions = AffiliateRecipient & { batchId: string; amountCents: number };
type Confirmation = { kind: 'prepare'; userId: string; amountCents: number; requestId: string } | { kind: 'cancel'; batch: AffiliateBatch; acknowledged: boolean } | { kind: 'complete'; instructions: Instructions; reference: string; paidAt: string };

/** Referral commissions: prepare one transfer per referrer, pay by hand, attach the slip, then record it. */
export function AffiliatePayoutPanel({ data }: { data: AffiliatePayoutDashboard }) {
  const router = useRouter();
  const action = useAdminAction();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [instructions, setInstructions] = useState<Instructions | null>(null);
  const [detailError, setDetailError] = useState('');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [attested, setAttested] = useState(false);
  const [busySlip, setBusySlip] = useState<string | null>(null);
  const ready = data.batches.filter(batch => batch.status === 'ready');
  const completed = data.batches.filter(batch => batch.status === 'completed').slice(0, 20);
  const instructionBatch = instructions && data.batches.find(batch => batch.id === instructions.batchId);

  async function open(batchId: string) {
    setDetailError(''); setInstructions(null); setReference(''); setPaidAt(''); setAttested(false);
    try { setInstructions((await postAdmin<{ instructions: Instructions }>('payout-affiliate-instructions', { batchId })).instructions); }
    catch (cause) { setDetailError(cause instanceof Error ? cause.message : 'เปิดข้อมูลการโอนไม่สำเร็จ'); }
  }
  async function attach(batch: AffiliateBatch, file: File | undefined) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 4 * 1024 * 1024 || file.size === 0) { setDetailError('เลือกไฟล์ PNG, JPG, WebP หรือ PDF ขนาดไม่เกิน 4 MB'); return; }
    setBusySlip(batch.id); setDetailError('');
    try {
      const form = new FormData(); form.set('kind', 'affiliate'); form.set('batchId', batch.id); form.set('file', file);
      const response = await fetch('/api/admin/payout-slip', { method: 'POST', body: form, credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'แนบสลิปไม่สำเร็จ');
      router.refresh();
    } catch (cause) { setDetailError(cause instanceof Error ? cause.message : 'แนบสลิปไม่สำเร็จ'); }
    finally { setBusySlip(null); }
  }
  async function viewSlip(batchId: string) {
    setDetailError('');
    try {
      const response = await fetch(`/api/admin/payout-slip?kind=affiliate&batchId=${encodeURIComponent(batchId)}`, { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.url !== 'string' || new URL(result.url).protocol !== 'https:') throw new Error(result?.error || 'เปิดสลิปไม่สำเร็จ');
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (cause) { setDetailError(cause instanceof Error ? cause.message : 'เปิดสลิปไม่สำเร็จ'); }
  }
  function confirmAction() {
    if (!confirmation) return;
    if (confirmation.kind === 'prepare') void action.run('payout-affiliate-prepare', { requestId: confirmation.requestId, userId: confirmation.userId }, (result) => result.batchId ? 'เตรียมรายการแล้ว ยังไม่ได้โอนเงิน' : 'ไม่มียอดพร้อมโอนหลังตรวจสอบอีกครั้ง', () => setConfirmation(null));
    if (confirmation.kind === 'cancel' && confirmation.acknowledged) void action.run('payout-affiliate-cancel', { batchId: confirmation.batch.id, confirmedNotTransferred: true }, 'ยกเลิกรายการแล้ว', () => { setConfirmation(null); setInstructions(null); });
    if (confirmation.kind === 'complete') void action.run('payout-affiliate-complete', { batchId: confirmation.instructions.batchId, reference: confirmation.reference, paidAt: confirmation.paidAt, amountCents: confirmation.instructions.amountCents, confirmed: true }, 'บันทึกการโอนค่าคอมแล้ว', () => { setConfirmation(null); setInstructions(null); });
  }

  return <div className="mt-10 space-y-5 border-t border-line pt-10">
    <Feedback error={confirmation ? '' : action.error || detailError} notice={action.notice} />
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-ink">ค่าคอมผู้แนะนำ</h2><p className="mt-1 text-sm text-muted">ยอดพร้อมโอนเมื่อรอบโอนของร้านที่หักค่าคอมนั้นบันทึกแล้ว · โอนเดือนละครั้ง</p></div><Badge>โอนด้วยตนเอง</Badge></div>
    <div className="grid gap-3 sm:grid-cols-3">{[['พร้อมเตรียมโอน', data.payables.reduce((sum, row) => sum + row.amountCents, 0), `${data.payables.length} คน`], ['รอร้านค้ารับเงิน', data.pendingCents, 'ยังไม่พร้อมโอน'], ['รอโอน', ready.reduce((sum, batch) => sum + batch.amountCents, 0), `${ready.length} รายการ`]].map(([label, cents, detail]) => <div key={label as string} className={cardClass}><p className="text-xs text-muted">{label}</p><p className="mt-3 text-2xl font-bold tabular-nums text-ink">{baht(cents as number)}</p><p className="mt-2 text-xs text-muted">{detail}</p></div>)}</div>
    {data.payables.length > 0 && <div className="space-y-3">{data.payables.map(row => <article key={row.userId} className={`${cardClass} flex flex-wrap items-center justify-between gap-4`}><div className="min-w-0"><p className="font-semibold text-ink">{row.recipientName || 'ยังไม่กรอกข้อมูลรับเงิน'}</p><p className="mt-1 text-xs text-muted">{row.destinationMasked || 'ผู้แนะนำต้องกรอกที่หน้า /learn/affiliate ก่อน'} · {row.commissionCount} รายการ</p></div><div className="flex items-center gap-3"><p className="text-xl font-bold tabular-nums text-ink">{baht(row.amountCents)}</p><button className={primaryClass} disabled={action.busy || !row.recipientName} onClick={() => setConfirmation({ kind: 'prepare', userId: row.userId, amountCents: row.amountCents, requestId: crypto.randomUUID() })}>เตรียมโอน</button></div></article>)}</div>}
    {!ready.length && !data.payables.length ? <EmptyState>ยังไม่มีค่าคอมที่พร้อมโอน</EmptyState> : ready.map(batch => <article key={batch.id} className={cardClass}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h4 className="font-semibold text-ink">{batch.recipientName}</h4><Badge>เตรียมไว้ · ยังไม่โอน</Badge></div><p className="mt-1 text-xs text-muted">{batch.destinationMasked} · สร้าง {dateLabel(batch.createdAt)}</p></div><p className="text-xl font-bold tabular-nums text-ink">{baht(batch.amountCents)}</p></div><div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4"><button className={buttonClass} onClick={() => open(batch.id)}>ดูข้อมูลสำหรับโอน</button><label className={`${buttonClass} cursor-pointer`}>{busySlip === batch.id ? 'กำลังแนบ…' : batch.hasSlip ? 'แทนที่สลิป' : 'แนบสลิป'}<input className="sr-only" type="file" aria-label={`แนบสลิปสำหรับ ${batch.recipientName}`} accept="image/png,image/jpeg,image/webp,application/pdf" disabled={busySlip !== null} onChange={(event) => attach(batch, event.target.files?.[0])} /></label>{batch.hasSlip ? <button className={buttonClass} onClick={() => viewSlip(batch.id)}>ดูสลิป</button> : <button className={buttonClass} disabled={action.busy} onClick={() => setConfirmation({ kind: 'cancel', batch, acknowledged: false })}>ยกเลิกรายการ</button>}</div></article>)}
    {instructions && <section aria-label="ข้อมูลสำหรับโอนค่าคอม" className="rounded-2xl border-2 border-accent/30 bg-paper p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><Badge tone="warning">ข้อมูลส่วนตัว · ใช้เพื่อโอนเงินเท่านั้น</Badge><button className={buttonClass} onClick={() => setInstructions(null)}>ปิดข้อมูล</button></div><dl className="mt-5 grid gap-4 rounded-xl bg-paper-dim p-4 sm:grid-cols-2">{[['ชื่อผู้รับ', instructions.recipientName], ['ยอดโอนที่ต้องตรง', baht(instructions.amountCents)], ['ธนาคาร / ช่องทาง', instructions.method === 'bank' ? getThaiBank((instructions.bankCode || '').toLowerCase())?.nameTh || instructions.bankCode : 'พร้อมเพย์'], ['เลขบัญชี / พร้อมเพย์', instructions.accountNumber || instructions.promptpayId || 'ไม่พบข้อมูล']].map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-all text-sm font-semibold text-ink">{value}</dd></div>)}</dl>
      <form className="mt-6 space-y-4 border-t border-line pt-6" onSubmit={(event) => { event.preventDefault(); const parsed = new Date(`${paidAt.length === 16 ? `${paidAt}:00` : paidAt}+07:00`); if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > Date.now()) { setDetailError('กรุณาระบุวันเวลาที่โอนจริง ซึ่งต้องไม่เป็นเวลาในอนาคต'); return; } setConfirmation({ kind: 'complete', instructions, reference: reference.trim(), paidAt: parsed.toISOString() }); }}><h4 className="font-semibold text-ink">บันทึกหลังโอนเงินจริงสำเร็จ</h4>{!instructionBatch?.hasSlip && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">แนบสลิปในรายการด้านบนก่อนบันทึกการโอนจริง</p>}<div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-ink">เลขอ้างอิงการโอนจากธนาคาร<input className={`${inputClass} mt-2`} value={reference} required minLength={6} maxLength={150} onChange={(event) => setReference(event.target.value)} autoComplete="off" /></label><label className="text-sm font-medium text-ink">วันและเวลาที่โอนจริง (เวลาไทย)<input type="datetime-local" step="1" className={`${inputClass} mt-2`} value={paidAt} required onChange={(event) => setPaidAt(event.target.value)} /></label></div><label className="flex items-start gap-3 text-sm text-ink"><input className="mt-1 size-4 shrink-0 accent-accent" type="checkbox" checked={attested} required onChange={(event) => setAttested(event.target.checked)} />ฉันโอนเงินจริงครบตามยอดและผู้รับข้างต้นแล้ว</label><button className={primaryClass} disabled={!instructionBatch?.hasSlip || !attested || reference.trim().length < 6 || !paidAt || action.busy}>ตรวจสอบหลักฐานการโอน</button></form></section>}
    {completed.length > 0 && <details className={cardClass}><summary className="cursor-pointer text-sm font-medium text-ink">โอนแล้ว ({completed.length})</summary><ul className="mt-3 space-y-2">{completed.map(batch => <li key={batch.id} className="flex flex-wrap justify-between gap-3 text-xs text-muted"><span>{batch.recipientName} · {dateLabel(batch.paidAt)} · อ้างอิง {batch.transferReference}{batch.reviewRequired ? ' · ต้องตรวจสอบเพิ่มเติม' : ''}</span><span className="tabular-nums text-ink">{baht(batch.amountCents)}</span></li>)}</ul></details>}
    {confirmation && <ConfirmDialog title={confirmation.kind === 'complete' ? 'ยืนยันหลักฐานการโอนค่าคอม' : confirmation.kind === 'prepare' ? 'เตรียมรายการโอนค่าคอม?' : 'ยกเลิกรายการโอนค่าคอม?'} busy={action.busy} onCancel={() => setConfirmation(null)} onConfirm={confirmAction} confirmDisabled={confirmation.kind === 'cancel' && !confirmation.acknowledged} confirmLabel={confirmation.kind === 'complete' ? 'ยืนยันบันทึกการโอนจริง' : confirmation.kind === 'prepare' ? 'ยืนยันการเตรียมรายการ' : 'ยืนยันการยกเลิก'}>
      {confirmation.kind === 'prepare' && <p>ยอดพร้อมโอน <strong>{baht(confirmation.amountCents)}</strong> ระบบจะตรวจสอบอีกครั้งแล้วล็อกยอดไว้ ขั้นตอนนี้ยังไม่โอนเงิน</p>}
      {confirmation.kind === 'cancel' && <><p>{confirmation.batch.recipientName} · {baht(confirmation.batch.amountCents)}</p><label className="flex items-start gap-3"><input className="mt-1 size-4 accent-accent" type="checkbox" checked={confirmation.acknowledged} onChange={(event) => setConfirmation({ ...confirmation, acknowledged: event.target.checked })} />ฉันยังไม่ได้โอนเงินจริงสำหรับรายการนี้</label></>}
      {confirmation.kind === 'complete' && <><p className="text-2xl font-bold text-ink">{baht(confirmation.instructions.amountCents)}</p><p className="font-semibold text-ink">{confirmation.instructions.recipientName}</p><p className="break-all">เลขอ้างอิง: {confirmation.reference}</p><p>โอนจริงเมื่อ: {dateLabel(confirmation.paidAt)} (เวลาไทย)</p></>}
      <Feedback error={action.error} notice="" />
    </ConfirmDialog>}
  </div>;
}
