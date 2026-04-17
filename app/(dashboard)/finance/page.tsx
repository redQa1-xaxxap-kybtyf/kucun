import { FinanceOverviewHeader } from '@/app/(dashboard)/finance/_components/FinanceOverviewHeader';
import { FinancePrioritySection } from '@/app/(dashboard)/finance/_components/FinancePrioritySection';
import { FinanceShortcutsSection } from '@/app/(dashboard)/finance/_components/FinanceShortcutsSection';
import { FinanceWorkbenchSection } from '@/app/(dashboard)/finance/_components/FinanceWorkbenchSection';
import {
  buildFinanceWorkbenchCards,
  getFinanceWorkbenchSummary,
} from '@/app/(dashboard)/finance/_lib/workbench-cards.builder';
import { safeAuth } from '@/lib/auth';
import type { AuthUser } from '@/lib/auth/context';
import { getFinanceOverview } from '@/lib/services/finance-statistics';
import { getFinanceWorkbenchMetrics } from '@/lib/services/finance-workbench-service';
import { USER_ROLE_LABELS, type UserRole } from '@/lib/types/user';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FinancePage() {
  const [overview, workbenchMetrics, session] = await Promise.all([
    getFinanceOverview(),
    getFinanceWorkbenchMetrics(),
    safeAuth('finance-page'),
  ]);
  const todayLabel = new Intl.DateTimeFormat('zh-CN').format(new Date());
  const authUser: AuthUser | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email ?? '',
        username:
          session.user.username ?? session.user.email ?? session.user.name ?? '',
        name: session.user.name ?? '当前用户',
        role: session.user.role ?? 'sales',
        status: session.user.status ?? 'active',
      }
    : null;
  const userRole = (session?.user?.role as UserRole | undefined) ?? 'sales';
  const roleLabel = USER_ROLE_LABELS[userRole];
  const workbenchCards = buildFinanceWorkbenchCards(
    workbenchMetrics,
    authUser,
    userRole
  );
  const workbenchSummary = getFinanceWorkbenchSummary(userRole);

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        <FinanceOverviewHeader
          dateLabel={todayLabel}
          roleLabel={roleLabel}
          overview={overview}
        />
        <FinanceWorkbenchSection
          cards={workbenchCards}
          summary={workbenchSummary}
        />
        <FinancePrioritySection overview={overview} />
        <FinanceShortcutsSection />
      </div>
    </div>
  );
}
