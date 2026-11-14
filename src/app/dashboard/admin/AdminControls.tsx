"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export const buttonClass = 'inline-flex items-center justify-center rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45';
export const primaryClass = `${buttonClass} border-accent bg-accent! text-white! hover:opacity-90`;
export const inputClass = 'w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15';
export const cardClass = 'rounded-2xl border border-line bg-paper p-5 sm:p-6';
export function baht(cents: number) { return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(cents / 100); }
export function dateLabel(date: string | null) { return date ? new Date(date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }) : 'ยังไม่มีข้อมูล'; }
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warning' }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${tone === 'good' ? 'bg-emerald-50 text-emerald-800' : tone === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-paper-dim text-ink-soft'}`}>{children}</span>;
}
export function EmptyState({ children }: { children: ReactNode }) { return <div className="rounded-2xl border border-dashed border-line px-5 py-12 text-center text-sm text-muted">{children}</div>; }

export async function postAdmin<T = { ok: boolean }>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', body: JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง');
  return data as T;
}
export function useAdminAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  async function run(path: string, body: unknown, message: string | ((result: Record<string, unknown>) => string), after?: () => void) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try { const result = await postAdmin<Record<string, unknown>>(path, body); setNotice(typeof message === 'function' ? message(result) : message); after?.(); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'ดำเนินการไม่สำเร็จ'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return { busy, error, notice, run };
}
export function Feedback({ error, notice }: { error: string; notice: string }) {
  return <>{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}</>;
}
export function ConfirmDialog({ title, children, busy, onCancel, onConfirm, confirmDisabled = false, confirmLabel = 'ยืนยันการเปลี่ยนแปลง' }: { title: string; children: ReactNode; busy: boolean; onCancel: () => void; onConfirm: () => void; confirmDisabled?: boolean; confirmLabel?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const focused = document.activeElement as HTMLElement | null;
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute('open', '');
    return () => { dialog?.close?.(); focused?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }} className="fixed inset-0 m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-line bg-paper p-6 text-ink shadow-lift-4 backdrop:bg-black/40">
    <h2 id={titleId} className="text-lg font-bold">{title}</h2>
    <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-soft">{children}</div>
    <div className="mt-6 flex flex-wrap justify-end gap-2"><button autoFocus className={buttonClass} disabled={busy} onClick={onCancel}>ยกเลิก</button><button className={primaryClass} disabled={busy || confirmDisabled} onClick={onConfirm}>{busy ? 'กำลังบันทึก…' : confirmLabel}</button></div>
  </dialog>;
}
