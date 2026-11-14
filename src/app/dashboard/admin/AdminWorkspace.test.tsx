import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminWorkspaceView } from './AdminWorkspace';
import type { AdminWorkspace } from '@/lib/admin/model';

const refresh = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }));
const data: AdminWorkspace = {
  overview: { users: 2, shops: 1, products: 1, orders: 3 },
  users: [{ id: 'user-1', email: 'seller@example.com', full_name: 'ผู้ขายหนึ่ง', created_at: '2026-11-01T00:00:00Z', note: '', payout_hold: false }],
  shops: [{ id: 'shop-1', owner_id: 'user-1', name: 'ร้านหนึ่ง', slug: 'one', published: true, moderated: false, created_at: '2026-11-01T00:00:00Z' }],
  products: [], audit: [], site: { hero_title: 'หัวข้อ', hero_subtitle: 'รายละเอียด', announcement: '', support_email: '' },
  pagination: { page: 1, pageSize: 25, hasMore: false }, query: '',
};

describe('Admin workspace', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })); });
  it('opens tabs without changing records and searches the selected section on the server', async () => {
    const user = userEvent.setup();
    render(<AdminWorkspaceView data={data} payoutPanel={<p>ข้อมูลการจ่ายเงิน</p>} />);
    await user.click(screen.getByRole('tab', { name: 'ผู้ใช้งาน' }));
    expect(screen.getByText('seller@example.com')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox'), 'seller');
    await user.click(screen.getByRole('button', { name: 'ค้นหา' }));
    expect(push).toHaveBeenCalledWith('/dashboard/admin?tab=users&q=seller&page=1');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('requires confirmation to hide a shop, allows cancellation, and retains an API failure', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: 'บันทึกไม่สำเร็จ' }) } as Response);
    render(<AdminWorkspaceView data={data} payoutPanel={null} initialTab="catalog" />);
    await user.click(screen.getByRole('button', { name: 'ซ่อนร้าน' }));
    expect(fetch).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ยกเลิก' }));
    expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'ซ่อนร้าน' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ยืนยันการเปลี่ยนแปลง' }));
    expect(fetch).toHaveBeenCalledWith('/api/admin/set-shop', expect.objectContaining({ body: JSON.stringify({ id: 'shop-1', published: false }) }));
    expect(await screen.findByRole('alert')).toHaveTextContent('บันทึกไม่สำเร็จ');
    expect(refresh).not.toHaveBeenCalled();
  });
  it('confirms a payout hold and submits only permitted user fields', async () => {
    const user = userEvent.setup();
    render(<AdminWorkspaceView data={data} payoutPanel={null} initialTab="users" />);
    await user.click(screen.getByRole('button', { name: 'จัดการผู้ใช้งาน' }));
    await user.type(screen.getByLabelText('บันทึกภายใน'), 'ตรวจสอบบัญชี');
    await user.click(screen.getByLabelText('พักการจ่ายเงินของผู้ใช้นี้'));
    await user.click(screen.getByRole('button', { name: 'ตรวจสอบก่อนบันทึก' }));
    expect(fetch).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ยืนยันการเปลี่ยนแปลง' }));
    expect(fetch).toHaveBeenCalledWith('/api/admin/save-user', expect.objectContaining({ body: JSON.stringify({ userId: 'user-1', note: 'ตรวจสอบบัญชี', payoutHold: true }) }));
    expect(refresh).toHaveBeenCalled();
  });
  it('filters publication status without mutating records', async () => {
    const user = userEvent.setup();
    render(<AdminWorkspaceView data={data} payoutPanel={null} initialTab="catalog" />);
    await user.selectOptions(screen.getByRole('combobox'), 'hidden');
    expect(screen.queryByText('ร้านหนึ่ง')).not.toBeInTheDocument();
    expect(screen.getByText('ไม่พบรายการที่ตรงกับตัวกรองในหน้านี้')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
