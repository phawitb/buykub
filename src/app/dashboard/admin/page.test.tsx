import { beforeEach, expect, it, vi } from 'vitest';
const { requireAdmin, workspace, payouts } = vi.hoisted(() => ({ requireAdmin: vi.fn(), workspace: vi.fn(), payouts: vi.fn() }));
vi.mock('@/lib/admin/access', () => ({ requireAdmin }));
vi.mock('@/lib/admin/service', () => ({ getAdminWorkspace: workspace }));
vi.mock('@/lib/payouts/service', () => ({ getPayoutDashboard: payouts }));
vi.mock('./AdminWorkspace', () => ({ AdminWorkspaceView: () => null }));
vi.mock('./PayoutPanel', () => ({ PayoutPanel: () => null }));
import AdminPage from './page';
beforeEach(() => vi.resetAllMocks());
it('does not load any private records before authorization succeeds', async () => {
  requireAdmin.mockRejectedValue(new Error('redirect'));
  await expect(AdminPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect');
  expect(workspace).not.toHaveBeenCalled(); expect(payouts).not.toHaveBeenCalled();
});
it('loads authorized data and normalizes untrusted pagination', async () => {
  requireAdmin.mockResolvedValue({}); workspace.mockResolvedValue({}); payouts.mockResolvedValue({});
  await AdminPage({ searchParams: Promise.resolve({ page: '-5', q: 'seller', tab: 'users' }) });
  expect(workspace).toHaveBeenCalledWith({ page: 1, query: 'seller' });
  expect(payouts).toHaveBeenCalledOnce();
});
