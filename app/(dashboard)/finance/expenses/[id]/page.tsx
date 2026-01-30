import { getServerSession } from 'next-auth';

import ExpenseDetailPageClient from './page-client';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';

/**
 * 费用记录详情页面
 * 遵循 Next.js 15.4 App Router 架构和全局约定规范
 */
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

interface ExpenseDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ExpenseDetailPage({
  params,
}: ExpenseDetailPageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const hasManagePermission = can(session?.user ?? null, 'finance:manage');

  return (
    <ExpenseDetailPageClient id={id} hasManagePermission={hasManagePermission} />
  );
}
