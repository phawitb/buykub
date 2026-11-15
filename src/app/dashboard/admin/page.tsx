import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin/access';
import { getAdminWorkspace } from '@/lib/admin/service';
import { getAgentUsageDashboard } from '@/lib/agent/admin';
import { getPayoutDashboard } from '@/lib/payouts/service';
import { AdminWorkspaceView } from './AdminWorkspace';
import { AgentPanel } from './AgentPanel';
import { PayoutPanel } from './PayoutPanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'ศูนย์ดูแลระบบ | BUYKUB', robots: { index: false, follow: false } };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; q?: string | string[]; tab?: string | string[] }> }) {
  await requireAdmin();
  const params = await searchParams;
  const requestedPage = typeof params.page === 'string' ? Number(params.page) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const query = typeof params.q === 'string' ? params.q.slice(0, 100) : '';
  const [data, payouts, agent] = await Promise.all([
    getAdminWorkspace({ page, query }),
    getPayoutDashboard(),
    // The agent tables arrive with their own migration; the rest of the
    // workspace stays usable if that migration has not been applied yet.
    getAgentUsageDashboard().catch(() => null),
  ]);
  return <AdminWorkspaceView key={`${page}:${query}`} data={data} initialTab={typeof params.tab === 'string' ? params.tab : undefined}
    payoutPanel={<PayoutPanel data={payouts} />}
    agentPanel={agent ? <AgentPanel data={agent} /> : <p className="rounded-2xl border border-dashed border-line px-5 py-12 text-center text-sm text-muted">ยังอ่านข้อมูลค่าใช้จ่าย AI ไม่ได้ · ตรวจว่าได้รัน migration 20261115120000_agent_product_drafts.sql แล้ว</p>} />;
}
