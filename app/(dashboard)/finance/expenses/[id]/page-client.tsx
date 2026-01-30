'use client';

import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { ContentLoading } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { ExpenseDetailClient } from '@/components/finance/expenses/expense-detail';
import { ErrorMessage } from '@/components/ui/error-message';
import { queryKeys } from '@/lib/queryKeys';
import { EXPENSE_TYPE_LABELS, type ExpenseRecord } from '@/lib/types/expense';
import { getErrorMessage } from '@/lib/utils/error-handler';

interface ExpenseDetailPageClientProps {
  id: string;
  hasManagePermission: boolean;
}

/**
 * 费用记录详情页面（Client）
 * - 仅处理数据拉取与交互渲染
 * - 权限在 Server 侧计算后下发，避免引入 next-auth 客户端依赖
 */
export default function ExpenseDetailPageClient({
  id,
  hasManagePermission,
}: ExpenseDetailPageClientProps) {
  const router = useRouter();

  const {
    data: expense,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.finance.expense(id),
    queryFn: async () => {
      const response = await fetch(`/api/finance/expenses/${id}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '获取费用记录失败');
      }

      const result = await response.json();
      return result.data as ExpenseRecord;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  if (error) {
    return (
      <ErrorMessage
        title="加载失败"
        message={getErrorMessage(error)}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!expense) {
    return (
      <ErrorMessage
        title="费用记录不存在"
        message="未找到指定的费用记录"
        onRetry={() => router.push('/finance/expenses')}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title={expense.expenseName}
          description={
            <div className="flex items-center gap-3">
              <span>费用编号：{expense.expenseNumber}</span>
              <span className="text-[hsl(var(--color-text-tertiary))]">•</span>
              <span>类型：{EXPENSE_TYPE_LABELS[expense.expenseType]}</span>
            </div>
          }
          icon={<Receipt className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-warning))"
        />

        <ExpenseDetailClient
          expense={expense}
          hasManagePermission={hasManagePermission}
        />
      </div>
    </div>
  );
}

