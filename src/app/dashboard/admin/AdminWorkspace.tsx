"use client";

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminWorkspace } from '@/lib/admin/model';
import { Badge, buttonClass, cardClass, dateLabel, EmptyState, inputClass } from './AdminControls';
import { CatalogPanel, UsersPanel, WebsitePanel } from './ManagementPanels';
import { ArrowRightIcon } from "@/components/icons";

const tabs = [{ id: 'overview', label: 'ภาพรวม' }, { id: 'payouts', label: 'จ่ายเงินผู้ขาย' }, { id: 'users', label: 'ผู้ใช้งาน' }, { id: 'catalog', label: 'ร้านค้า / สินค้า' }, { id: 'website', label: 'เว็บไซต์' }, { id: 'activity', label: 'ประวัติการทำงาน' }] as const;
type Tab = typeof tabs[number]['id'];
export function adminTab(value?: string): Tab { return tabs.find((tab) => tab.id === value)?.id ?? 'overview'; }
const actionLabels: Record<string, string> = { 'payout.prepared_for_manual_transfer': 'เตรียมรายการจ่ายเงินด้วยตนเอง', 'payout.cancelled': 'ยกเลิกรายการที่ยังไม่โอน', 'payout.manual_transfer_attested': 'ยืนยันและบันทึกการโอนเงินจริง', 'payout.manual_transfer_attested_requires_review': 'บันทึกการโอนจริง · มียอดหรือข้อมูลต้องตรวจสอบ', 'payout.stripe_reconciliation_finished': 'ตรวจสอบยอดกับ Stripe', 'payout.slip_attached': 'แนบสลิปโอนเงิน', 'payout.slip_replaced': 'เปลี่ยนสลิปโอนเงิน', 'payout.manual_mode_schedule_updated': 'แก้ไขการตั้งค่าจ่ายเงิน', 'save-user': 'แก้ไขการดูแลผู้ใช้งาน', 'set-shop': 'แก้ไขการเผยแพร่ร้านค้า', 'set-product': 'แก้ไขการเผยแพร่สินค้า', 'save-site': 'แก้ไขข้อความเว็บไซต์', 'user.update': 'แก้ไขการดูแลผู้ใช้งาน', 'shop.publication': 'แก้ไขการเผยแพร่ร้านค้า', 'product.publication': 'แก้ไขการเผยแพร่สินค้า', 'site.update': 'แก้ไขข้อความเว็บไซต์', 'payout.prepare': 'เตรียมรายการจ่ายเงิน', 'payout.complete': 'บันทึกการโอนเงินจริง', 'payout.cancel': 'ยกเลิกรายการจ่ายเงิน', 'payout.reconcile': 'ตรวจสอบยอดกับ Stripe' };

export function AdminWorkspaceView({ data, payoutPanel, initialTab = 'overview' }: { data: AdminWorkspace; payoutPanel: ReactNode; initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(adminTab(initialTab));
  const [query, setQuery] = useState(data.query);
  const router = useRouter();
  const searchable = tab === 'users' || tab === 'catalog';
  const paginated = searchable;
  function navigate(page: number) {
    const params = new URLSearchParams({ tab, q: query.trim(), page: String(page) });
    router.push(`/dashboard/admin?${params}`);
  }
  function changeTab(next: Tab) {
    setTab(next);
    // Keep the selected tab in the URL without refetching private records on every click.
    const url = new URL(window.location.href); url.searchParams.set('tab', next); window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }
  return <div className="mx-auto w-full max-w-6xl pb-12">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">ศูนย์ดูแลระบบ</h1><p className="mt-2 text-sm leading-relaxed text-muted">ดูแลร้านค้า ผู้ใช้งาน และการจ่ายเงินในที่เดียว</p></div><Badge>เฉพาะผู้ดูแลระบบ</Badge></header>
    <div role="tablist" aria-label="ส่วนงานผู้ดูแล" className="mt-7 flex gap-1 overflow-x-auto border-b border-line pb-px">{tabs.map((item, index) => <button key={item.id} role="tab" id={`admin-tab-${item.id}`} aria-controls="admin-panel" aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; changeTab(next.id); document.getElementById(`admin-tab-${next.id}`)?.focus(); } }} onClick={() => changeTab(item.id)} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-accent ${tab === item.id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'}`}>{item.label}</button>)}</div>
    <section id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`} className="mt-6 space-y-5">
      {searchable && <form role="search" onSubmit={(event) => { event.preventDefault(); navigate(1); }} className="flex gap-2"><input aria-label="ค้นหาผู้ใช้งาน ร้านค้า หรือสินค้า" type="search" className={inputClass} placeholder={tab === 'users' ? 'ค้นหาชื่อหรืออีเมลผู้ใช้งาน' : 'ค้นหาชื่อร้านหรือสินค้า'} maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} /><button className={buttonClass}>ค้นหา</button></form>}
      {tab === 'overview' && <><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[{ label: 'ผู้ใช้งานทั้งหมด', value: data.overview.users, target: 'users' }, { label: 'ร้านค้า', value: data.overview.shops, target: 'catalog' }, { label: 'สินค้า', value: data.overview.products, target: 'catalog' }, { label: 'คำสั่งซื้อทั้งหมด', value: data.overview.orders, target: 'payouts' }].map((metric) => <div key={metric.label} className={cardClass}><p className="text-xs text-muted">{metric.label}</p><p className="mt-3 text-3xl font-bold tabular-nums text-ink">{metric.value.toLocaleString('th-TH')}</p><button className="mt-5 text-xs font-semibold text-accent" onClick={() => changeTab(metric.target as Tab)}>เปิดส่วนงาน<ArrowRightIcon className="ml-1.5 inline size-3.5 align-[-0.15em]" /></button></div>)}</div><div className="grid gap-5 md:grid-cols-2"><div className={`${cardClass} bg-linear-to-br from-accent/5 to-paper`}><Badge tone="warning">การจ่ายเงินแบบตรวจสอบด้วยตนเอง</Badge><h2 className="mt-4 text-lg font-bold text-ink">ตรวจสอบยอดก่อนจ่ายทุกครั้ง</h2><p className="mt-2 text-sm leading-relaxed text-muted">จ่ายได้เฉพาะยอดที่ตรวจสอบกับ Stripe แล้ว เงินพร้อมใช้ พ้นระยะประกัน และไม่ติดข้อจำกัดการคืนเงิน</p><button className={`${buttonClass} mt-5`} onClick={() => changeTab('payouts')}>ไปที่การจ่ายเงินผู้ขาย<ArrowRightIcon className="ml-1.5 inline size-3.5 align-[-0.15em]" /></button></div><div className={cardClass}><h2 className="text-base font-semibold text-ink">งานดูแลประจำวัน</h2><div className="mt-4 divide-y divide-line">{[{ label: 'ดูแลบัญชีและพักการจ่ายเงิน', target: 'users' }, { label: 'ตรวจสอบการเผยแพร่ร้านและสินค้า', target: 'catalog' }, { label: 'อัปเดตข้อความบนหน้าเว็บไซต์', target: 'website' }].map((item) => <button key={item.target} onClick={() => changeTab(item.target as Tab)} className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm text-ink-soft hover:text-accent">{item.label}<ArrowRightIcon className="size-3.5" /></button>)}</div></div></div></>}
      {tab === 'payouts' && payoutPanel}
      {tab === 'users' && <UsersPanel users={data.users} />}
      {tab === 'catalog' && <CatalogPanel shops={data.shops} products={data.products} />}
      {tab === 'website' && <WebsitePanel site={data.site} />}
      {tab === 'activity' && <><div><h2 className="text-lg font-semibold text-ink">ประวัติการทำงานของผู้ดูแล</h2><p className="mt-1 text-xs text-muted">เวลาไทย · แสดง 50 กิจกรรมล่าสุด</p></div>{!data.audit.length ? <EmptyState>ยังไม่มีกิจกรรมในหน้านี้</EmptyState> : <ol className="divide-y divide-line rounded-2xl border border-line bg-paper">{data.audit.map((item) => <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-5"><div className="min-w-0"><p className="text-sm font-semibold text-ink">{actionLabels[item.action] || item.action}</p>{item.target_id && <p className="mt-1 break-all text-xs text-muted">รายการ {item.target_id}</p>}<p className="mt-1 break-all text-xs text-muted">ผู้ดำเนินการ {item.actor_id}</p></div><time className="text-xs text-muted" dateTime={item.created_at}>{dateLabel(item.created_at)}</time></li>)}</ol>}</>}
      {paginated && <div className="flex items-center justify-between gap-3 border-t border-line pt-5"><p className="text-xs text-muted">หน้า {data.pagination.page} · สูงสุด {data.pagination.pageSize} รายการต่อประเภท</p><div className="flex gap-2"><button className={buttonClass} disabled={data.pagination.page <= 1} onClick={() => navigate(data.pagination.page - 1)}>ก่อนหน้า</button><button className={buttonClass} disabled={!data.pagination.hasMore} onClick={() => navigate(data.pagination.page + 1)}>ถัดไป</button></div></div>}
    </section>
  </div>;
}
