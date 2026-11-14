import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin/access';
import { getAdminWorkspace } from '@/lib/admin/service';
import { getPayoutDashboard } from '@/lib/payouts/service';
import { AdminWorkspaceView } from './AdminWorkspace';
import { PayoutPanel } from './PayoutPanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'ศูนย์ดูแลระบบ | BUYKUB', robots: { index: false, follow: false } };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; q?: string | string[]; tab?: string | string[] }> }) {
  await requireAdmin();
  const params = await searchParams;
  const requestedPage = typeof params.page === 'string' ? Number(params.page) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const query = typeof params.q === 'string' ? params.q.slice(0, 100) : '';
  const [data, payouts] = await Promise.all([getAdminWorkspace({ page, query }), getPayoutDashboard()]);
  return <AdminWorkspaceView key={`${page}:${query}`} data={data} initialTab={typeof params.tab === 'string' ? params.tab : undefined} payoutPanel={<PayoutPanel data={payouts} />} />;
}
