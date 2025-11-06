'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';

import { ContentLoading } from '@/components/common/loading';
import { ExpenseDetailClient } from '@/components/finance/expenses/expense-detail';
import { ErrorMessage } from '@/components/ui/error-message';
import { queryKeys } from '@/lib/queryKeys';
import type { ExpenseRecord } from '@/lib/types/expense';
import { getErrorMessage } from '@/lib/utils/error-handler';

/**
 * 费用记录详情页面
 * 遵循 Next.js 15.4 App Router 架构和全局约定规范
 */
export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // 使用 React Query 获取费用记录详情
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
    staleTime: 5 * 60 * 1000, // 5分钟缓存
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
    <div className="space-y-6 p-6">
      {/* 页面头部 - 显示费用编号 */}
      <div className="flex items-center space-x-2">
        <span className="text-muted-foreground">
          费用编号：{expense.expenseNumber}
        </span>
      </div>

      {/* 详情内容 */}
      <ExpenseDetailClient expense={expense} />
    </div>
  );
}
