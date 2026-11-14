"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getThaiBank } from '@/app/dashboard/settings/thai-banks';
import type { PayoutBatchSummary, PayoutDashboard, PayoutInstructions } from '@/lib/payouts/model';
import { Badge, baht, buttonClass, cardClass, ConfirmDialog, dateLabel, EmptyState, Feedback, inputClass, postAdmin, primaryClass, useAdminAction } from './AdminControls';
import { ExternalIcon } from "@/components/icons";

const reasonLabels: Record<string, string> = { unverified_payment: 'ยังไม่ได้ยืนยันการรับชำระ', unverified: 'ยังไม่ได้ยืนยันการรับชำระ', not_real_paid_order: 'ไม่ใช่ออเดอร์ที่ชำระเงินจริง', payment_mismatch_or_not_live: 'ข้อมูลรับชำระไม่ตรงหรือไม่ใช่เงินจริง', charge_mismatch: 'ยอดตัดชำระไม่ตรงกับคำสั่งซื้อ', disputed_or_unknown: 'มีข้อพิพาทหรือยังยืนยันสถานะไม่ได้', funds_not_available: 'เงินยังไม่พร้อมใช้', seven_day_hold: 'ยังไม่พ้นระยะประกัน 7 วัน', refund_mismatch: 'ข้อมูลการคืนเงินไม่ตรง', refund_pending_or_unknown: 'มีรายการคืนเงินที่ยังไม่สิ้นสุด', refund_total_mismatch: 'ยอดคืนเงินไม่ตรงกับข้อมูลรับชำระ', fully_refunded: 'คืนเงินเต็มจำนวนแล้ว', checkout_reference_mismatch: 'รหัสอ้างอิงการชำระเงินไม่ตรง', local_refunded_order_requires_review: 'ออเดอร์คืนเงินต้องตรวจสอบเพิ่มเติม' };
const bankLabel = (code: string | null) => code ? getThaiBank(code.toLowerCase())?.nameTh || code : 'บัญชีธนาคาร';
const statusLabels = { ready: 'เตรียมไว้ · ยังไม่โอน', completed: 'จ่ายแล้ว · ผู้ดูแลยืนยัน', cancelled: 'ยกเลิกแล้ว', review_required: 'ต้องตรวจสอบเพิ่มเติม' } as const;
type Confirmation = { kind: 'prepare'; requestId: string } | { kind: 'cancel'; batch: PayoutBatchSummary; acknowledged: boolean } | { kind: 'complete'; instructions: PayoutInstructions; reference: string; paidAt: string };

function SlipAttachment({ batch, hasSlip, onAttached }: { batch: PayoutBatchSummary; hasSlip: boolean; onAttached: () => void }) {
  const router = useRouter();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [slipUrl, setSlipUrl] = useState('');
  const inFlight = useRef(false);
  const canAttach = batch.status === 'ready' || batch.status === 'review_required' || (batch.status === 'completed' && !hasSlip);
  async function upload() {
    if (!file || inFlight.current || !canAttach) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 4 * 1024 * 1024 || file.size === 0) { setError('เลือกไฟล์ PNG, JPG, WebP หรือ PDF ขนาดไม่เกิน 4 MB'); return; }
    inFlight.current = true; setBusy(true); setError(''); setNotice(''); setSlipUrl('');
    try {
      const form = new FormData(); form.set('batchId', batch.id); form.set('file', file);
      const response = await fetch('/api/admin/payout-slip', { method: 'POST', body: form, credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'แนบสลิปไม่สำเร็จ กรุณาลองอีกครั้ง');
      onAttached(); setFile(null); setNotice(batch.status === 'completed' ? 'แนบสลิปในรายการที่จ่ายแล้วเรียบร้อย' : 'แนบสลิปแล้ว · ยังต้องยืนยันการโอนจริง'); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'แนบสลิปไม่สำเร็จ'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function view() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setSlipUrl('');
    try {
      const response = await fetch(`/api/admin/payout-slip?batchId=${encodeURIComponent(batch.id)}`, { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.url !== 'string') throw new Error(result?.error || 'เปิดสลิปไม่สำเร็จ กรุณาลองอีกครั้ง');
      const url = new URL(result.url); if (url.protocol !== 'https:') throw new Error('ลิงก์สลิปไม่ถูกต้อง');
      setSlipUrl(url.href);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'เปิดสลิปไม่สำเร็จ'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  if (!canAttach && !hasSlip) return null;
  return <div className="mt-4 space-y-3 border-t border-line pt-4"><div className="flex flex-wrap items-center gap-3"><Badge tone={hasSlip ? 'good' : 'neutral'}>{hasSlip ? 'มีสลิปแล้ว' : 'ยังไม่ได้แนบสลิป'}</Badge>{hasSlip && <button className={buttonClass} disabled={busy} onClick={view}>ดูสลิป</button>}{slipUrl && <a className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent underline underline-offset-4" href={slipUrl} target="_blank" rel="noopener noreferrer">เปิดไฟล์สลิป<ExternalIcon className="size-3.5" /></a>}</div>{slipUrl && <p className="text-xs text-muted">ลิงก์เปิดไฟล์ใช้ได้ 1 นาที กดดูสลิปอีกครั้งหากหมดอายุ</p>}{canAttach && <div className="flex flex-wrap items-center gap-2"><label htmlFor={inputId} className={`${buttonClass} cursor-pointer`}>{hasSlip ? 'เลือกสลิปใหม่' : 'เลือกไฟล์สลิป'}<input id={inputId} aria-label={`เลือกสลิปสำหรับ ${batch.shopName}`} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" disabled={busy} onChange={(event) => { setFile(event.target.files?.[0] || null); setError(''); }} /></label><span className="max-w-full break-all text-xs text-muted">{file?.name || 'PNG, JPG, WebP หรือ PDF · ไม่เกิน 4 MB'}</span>{file && <button className={primaryClass} disabled={busy} onClick={upload}>{busy ? 'กำลังแนบสลิป…' : hasSlip ? 'แทนที่สลิป' : 'แนบสลิป'}</button>}</div>}<Feedback error={error} notice={notice} /></div>;
}

export function PayoutPanel({ data }: { data: PayoutDashboard }) {
  const action = useAdminAction();
  const [filter, setFilter] = useState('ready');
  const [search, setSearch] = useState('');
  const [attachedSlips, setAttachedSlips] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [instructions, setInstructions] = useState<PayoutInstructions | null>(null);
  const [recordOnly, setRecordOnly] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [attested, setAttested] = useState(false);
  const detailRequest = useRef(0);
  const detailsRef = useRef<HTMLElement>(null);
  useEffect(() => { if (instructions) { detailsRef.current?.focus({ preventScroll: true }); detailsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); } }, [instructions]);
  const batches = data.batches.filter((batch) => (filter === 'all' || batch.status === filter) && `${batch.shopName} ${batch.recipientName}`.toLocaleLowerCase('th-TH').includes(search.toLocaleLowerCase('th-TH').trim()));
  const instructionHasSlip = Boolean(instructions && (attachedSlips.has(instructions.batchId) || data.batches.find((batch) => batch.id === instructions.batchId)?.hasSlip));
  async function openInstructions(batchId: string, recording = false) {
    const request = ++detailRequest.current;
    setRecordOnly(recording); setLoadingId(batchId); setDetailError(''); setInstructions(null); setReference(''); setPaidAt(''); setAttested(false);
    try { const result = await postAdmin<{ instructions: PayoutInstructions }>(recording ? 'payout-record' : 'payout-instructions', { batchId }); if (request === detailRequest.current) setInstructions(result.instructions); }
    catch (cause) { if (request === detailRequest.current) setDetailError(cause instanceof Error ? cause.message : 'เปิดข้อมูลการโอนไม่สำเร็จ'); }
    finally { if (request === detailRequest.current) setLoadingId(null); }
  }
  function exportInstructions() {
    if (!instructions) return;
    const content = ['BUYKUB — ข้อมูลเตรียมโอนเงิน (ยังไม่ใช่หลักฐานการโอน)', `รายการ: ${instructions.batchId}`, `ร้าน: ${instructions.shopName}`, `ผู้รับ: ${instructions.recipientName}`, `ยอด: ${baht(instructions.amountCents)}`, `ช่องทาง: ${instructions.method === 'bank' ? bankLabel(instructions.bankCode) : 'พร้อมเพย์'}`, `เลขบัญชี/พร้อมเพย์: ${instructions.accountNumber || instructions.promptpayId}`, instructions.warning].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `payout-${instructions.batchId}.txt`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function confirmAction() {
    if (!confirmation) return;
    if (confirmation.kind === 'prepare') void action.run('payout-prepare', { requestId: confirmation.requestId }, (result) => Array.isArray(result.batchIds) && result.batchIds.length > 0 ? `เตรียม ${result.batchIds.length} รายการสำหรับตรวจสอบแล้ว ยังไม่ได้โอนเงิน` : 'ไม่มีรายการใหม่ที่ผ่านเกณฑ์หลังตรวจสอบอีกครั้ง ยังไม่ได้โอนเงิน', () => setConfirmation(null));
    if (confirmation.kind === 'cancel' && confirmation.acknowledged && !confirmation.batch.hasSlip && !attachedSlips.has(confirmation.batch.id)) void action.run('payout-cancel', { batchId: confirmation.batch.id, confirmedNotTransferred: true }, 'ยกเลิกรายการเตรียมจ่ายแล้ว', () => { setConfirmation(null); setInstructions(null); });
    if (confirmation.kind === 'complete') void action.run('payout-complete', { batchId: confirmation.instructions.batchId, reference: confirmation.reference, paidAt: confirmation.paidAt, amountCents: confirmation.instructions.amountCents, confirmed: true }, 'บันทึกการโอนจริงตามหลักฐานที่ผู้ดูแลยืนยันแล้ว', () => { setConfirmation(null); setInstructions(null); });
  }
  return <div className="space-y-5">
    <Feedback error={confirmation ? '' : action.error || detailError} notice={action.notice} />
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-ink">จ่ายเงินให้ผู้ขาย</h2><p className="mt-1 text-sm text-muted">เตรียมยอด → โอนผ่านธนาคาร → แนบสลิปและยืนยันการจ่าย</p></div><Badge>โอนด้วยตนเอง</Badge></div>
    <div className="grid gap-3 sm:grid-cols-3">{[{ label: 'พร้อมเตรียมจ่าย', value: baht(data.eligibleCents), detail: `${data.eligibleOrderCount} ออเดอร์ · สุทธิหลังค่าบริการ` }, { label: 'รอจ่าย', value: baht(data.batches.filter((batch) => batch.status === 'ready').reduce((total, batch) => total + batch.amountCents, 0)), detail: `${data.batches.filter((batch) => batch.status === 'ready').length} รายการ · รอโอนและแนบสลิป` }, { label: 'จ่ายแล้ว', value: baht(data.batches.filter((batch) => batch.status === 'completed').reduce((total, batch) => total + batch.amountCents, 0)), detail: `${data.batches.filter((batch) => batch.status === 'completed').length} รายการ · ผู้ดูแลยืนยันการโอน` }].map((metric) => <div key={metric.label} className={cardClass}><p className="text-xs text-muted">{metric.label}</p><p className="mt-3 text-2xl font-bold tabular-nums text-ink">{metric.value}</p><p className="mt-2 text-xs text-muted">{metric.detail}</p></div>)}</div>
    <div className={cardClass}><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-semibold text-ink">ตรวจสอบยอดและเตรียมจ่าย</h3><p className="mt-2 text-xs leading-relaxed text-muted">ตรวจสอบล่าสุด: {dateLabel(data.lastReconciledAt)} · เวลาไทย</p></div><div className="flex flex-wrap gap-2"><button disabled={action.busy || loadingId !== null} className={buttonClass} onClick={() => action.run('payout-reconcile', {}, 'ตรวจสอบสถานะการชำระเงินกับ Stripe แล้ว')}>{action.busy ? 'กำลังดำเนินการ…' : 'ตรวจสอบยอดกับ Stripe'}</button><button disabled={action.busy || data.eligibleOrderCount === 0 || data.eligibleCents <= 0} className={primaryClass} onClick={() => setConfirmation({ kind: 'prepare', requestId: crypto.randomUUID() })}>เตรียมรายการจ่ายเงิน</button></div></div><p className="mt-4 text-xs leading-relaxed text-muted">ยอดต้องเป็นเงินจริงที่ชำระสำเร็จ พร้อมใช้ พ้นประกันอย่างน้อย 7 วัน และผ่านการตรวจสอบการคืนเงิน ข้อพิพาท และบัญชีผู้รับ</p>{data.blockedReasons.length > 0 && <details className="mt-4 border-t border-line pt-4"><summary className="cursor-pointer text-sm font-medium text-ink">เหตุผลที่ยังจ่ายไม่ได้ ({data.blockedOrderCount} ออเดอร์)</summary><ul className="mt-3 space-y-2">{data.blockedReasons.map((item) => <li key={item.reason} className="flex justify-between gap-3 text-xs text-muted"><span>{reasonLabels[item.reason] || item.reason}</span><span>{item.count}</span></li>)}</ul></details>}</div>
    <div className="space-y-4"><div className="flex flex-wrap gap-2" aria-label="สถานะการจ่ายเงิน">{([{ value: 'ready', label: 'รอจ่าย' }, { value: 'completed', label: 'จ่ายแล้ว' }, { value: 'review_required', label: 'ต้องตรวจสอบ' }, { value: 'all', label: 'ทั้งหมด' }] as const).map((item) => <button key={item.value} className={filter === item.value ? primaryClass : buttonClass} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label} ({data.batches.filter((batch) => item.value === 'all' || batch.status === item.value).length})</button>)}</div><input className={inputClass} type="search" aria-label="ค้นหาร้านหรือผู้รับเงิน" placeholder="ค้นหาชื่อร้านหรือชื่อผู้รับเงิน" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    {!batches.length ? <EmptyState>ยังไม่มีรายการจ่ายเงินในสถานะนี้</EmptyState> : <div className="space-y-3">{batches.map((batch) => <article key={batch.id} className={cardClass}><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-ink">{batch.shopName}</h4><Badge tone={batch.status === 'completed' ? 'good' : batch.status === 'review_required' ? 'warning' : 'neutral'}>{statusLabels[batch.status]}</Badge></div><p className="mt-2 text-sm text-ink-soft">{batch.recipientName}</p><p className="mt-1 text-xs text-muted">{batch.destinationMasked}</p><p className="mt-3 text-xs text-muted">{batch.orderCount} ออเดอร์ · สร้าง {dateLabel(batch.createdAt)}</p></div><div className="text-right"><p className="text-xl font-bold tabular-nums text-ink">{baht(batch.amountCents)}</p>{(batch.status === 'ready' || batch.status === 'review_required') && <div className="mt-4 flex flex-wrap justify-end gap-2"><button className={buttonClass} disabled={action.busy || loadingId !== null} onClick={() => openInstructions(batch.id, batch.status === 'review_required' || batch.hasSlip || attachedSlips.has(batch.id))}>{loadingId === batch.id ? 'กำลังเปิดข้อมูล…' : batch.status === 'review_required' || batch.hasSlip || attachedSlips.has(batch.id) ? 'บันทึกการโอนที่ทำแล้ว' : 'ดูข้อมูลสำหรับโอน'}</button>{(batch.status === 'ready' || batch.status === 'review_required') && !batch.hasSlip && !attachedSlips.has(batch.id) && <button className={buttonClass} disabled={action.busy} onClick={() => setConfirmation({ kind: 'cancel', batch, acknowledged: false })}>ยกเลิกรายการ</button>}</div>}</div></div>{batch.status === 'completed' && <p className="mt-4 break-all border-t border-line pt-4 text-xs text-muted">ผู้ดูแลบันทึกการโอน: {dateLabel(batch.paidAt)} · อ้างอิง {batch.transferReference}</p>}{batch.status === 'review_required' && <p className="mt-4 text-sm text-amber-800">อย่าโอนเพิ่ม หากโอนเงินจริงไปแล้ว ให้แนบสลิปและบันทึกรายการที่โอน เพื่อป้องกันการจ่ายซ้ำ</p>}{batch.completionWarning && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{batch.completionWarning}</p>}<SlipAttachment batch={batch} hasSlip={batch.hasSlip || attachedSlips.has(batch.id)} onAttached={() => setAttachedSlips((current) => new Set([...current, batch.id]))} /></article>)}</div>}
    {instructions && <section ref={detailsRef} tabIndex={-1} aria-label="ข้อมูลส่วนตัวสำหรับโอนเงิน" className="rounded-2xl border-2 border-accent/30 bg-paper p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><Badge tone="warning">{recordOnly ? 'ข้อมูลการโอนเดิม · ห้ามโอนซ้ำ' : 'ข้อมูลส่วนตัว · ใช้เพื่อโอนเงินเท่านั้น'}</Badge><h3 className="mt-3 text-lg font-semibold text-ink">{instructions.shopName}</h3></div><button className={buttonClass} onClick={() => { ++detailRequest.current; setInstructions(null); }}>ปิดข้อมูล</button></div><dl className="mt-5 grid gap-4 rounded-xl bg-paper-dim p-4 sm:grid-cols-2">{[['ชื่อผู้รับ', instructions.recipientName], ['ยอดโอนที่ต้องตรง', baht(instructions.amountCents)], ['ธนาคาร / ช่องทาง', instructions.method === 'bank' ? bankLabel(instructions.bankCode) : 'พร้อมเพย์'], ['เลขบัญชี / พร้อมเพย์', instructions.accountNumber || instructions.promptpayId || 'ไม่พบข้อมูล']].map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-all text-sm font-semibold text-ink">{value}</dd></div>)}</dl><p className="mt-4 text-sm leading-relaxed text-amber-900">{instructions.warning}</p>{!recordOnly && <button className={`${buttonClass} mt-4`} onClick={exportInstructions}>ดาวน์โหลดข้อมูลสำหรับโอน</button>}<form className="mt-6 space-y-4 border-t border-line pt-6" onSubmit={(event) => { event.preventDefault(); if (!instructionHasSlip || !attested || reference.trim().length < 6 || !paidAt) return; const parsed = new Date(`${paidAt.length === 16 ? `${paidAt}:00` : paidAt}+07:00`); if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > Date.now()) { setDetailError('กรุณาระบุวันเวลาที่โอนจริง ซึ่งต้องไม่เป็นเวลาในอนาคต'); return; } setDetailError(''); setConfirmation({ kind: 'complete', instructions, reference: reference.trim(), paidAt: parsed.toISOString() }); }}><h4 className="font-semibold text-ink">บันทึกหลังโอนเงินจริงสำเร็จ</h4>{!instructionHasSlip && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">แนบสลิปในรายการด้านบนก่อนบันทึกการโอนจริง</p>}<div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-ink">เลขอ้างอิงการโอนจากธนาคาร<input className={`${inputClass} mt-2`} value={reference} required minLength={6} maxLength={150} onChange={(event) => setReference(event.target.value)} autoComplete="off" /></label><label className="text-sm font-medium text-ink">วันและเวลาที่โอนจริง (เวลาไทย)<input type="datetime-local" step="1" className={`${inputClass} mt-2`} value={paidAt} required onChange={(event) => setPaidAt(event.target.value)} /></label></div><label className="flex items-start gap-3 text-sm leading-relaxed text-ink"><input className="mt-1 size-4 shrink-0 accent-accent" type="checkbox" checked={attested} required onChange={(event) => setAttested(event.target.checked)} />ฉันโอนเงินจริงครบตามยอดและผู้รับข้างต้นแล้ว</label><button className={primaryClass} disabled={!instructionHasSlip || !attested || reference.trim().length < 6 || !paidAt || action.busy}>ตรวจสอบหลักฐานการโอน</button></form></section>}
    <p className="text-xs leading-relaxed text-muted">ระบบนี้บันทึกการโอนที่ผู้ดูแลทำเอง การโอนอัตโนมัติจะเปิดให้ใช้งานภายหลัง</p>
    {confirmation && <ConfirmDialog title={confirmation.kind === 'complete' ? 'ยืนยันหลักฐานการโอนเงินจริง' : confirmation.kind === 'prepare' ? 'เตรียมรายการสำหรับตรวจสอบ?' : 'ยกเลิกรายการเตรียมจ่าย?'} busy={action.busy} onCancel={() => setConfirmation(null)} onConfirm={confirmAction} confirmDisabled={confirmation.kind === 'cancel' && !confirmation.acknowledged} confirmLabel={confirmation.kind === 'complete' ? 'ยืนยันบันทึกการโอนจริง' : confirmation.kind === 'prepare' ? 'ยืนยันการเตรียมรายการ' : 'ยืนยันการเปลี่ยนแปลง'}>
      {confirmation.kind === 'prepare' && <><p>ยอดผ่านเกณฑ์ปัจจุบัน <strong>{baht(data.eligibleCents)}</strong> จาก {data.eligibleOrderCount} ออเดอร์</p><p>ระบบจะตรวจสอบสิทธิ์อีกครั้ง แล้วสร้างรายการแยกตามร้านค้า ขั้นตอนนี้ยังไม่โอนเงินและไม่บันทึกว่าจ่ายแล้ว</p></>}
      {confirmation.kind === 'cancel' && <><p>{confirmation.batch.shopName} · {baht(confirmation.batch.amountCents)}</p><p>ยอดจะกลับไปตรวจสอบเพื่อเตรียมจ่ายใหม่ ห้ามยกเลิกหากโอนเงินไปแล้ว</p><label className="flex items-start gap-3"><input className="mt-1 size-4 accent-accent" type="checkbox" checked={confirmation.acknowledged} onChange={(event) => setConfirmation({ ...confirmation, acknowledged: event.target.checked })} />ฉันยังไม่ได้โอนเงินจริงและยังไม่มีสลิปของรายการนี้</label></>}
      {confirmation.kind === 'complete' && <><p className="text-2xl font-bold text-ink">{baht(confirmation.instructions.amountCents)}</p><p className="font-semibold text-ink">{confirmation.instructions.recipientName}</p><p>ร้าน {confirmation.instructions.shopName}</p><p className="break-all">เลขอ้างอิง: {confirmation.reference}</p><p>โอนจริงเมื่อ: {dateLabel(confirmation.paidAt)} (เวลาไทย)</p><p className="rounded-xl bg-amber-50 p-3 text-amber-900">{confirmation.instructions.warning}</p><p>การบันทึกนี้อ้างอิงหลักฐานที่คุณยืนยัน และจะป้องกันการจัดรายการนี้จ่ายซ้ำ</p></>}
      <Feedback error={action.error} notice="" />
    </ConfirmDialog>}
  </div>;
}
