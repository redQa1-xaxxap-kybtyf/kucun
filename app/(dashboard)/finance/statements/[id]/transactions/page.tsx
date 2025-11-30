'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { ContentLoading } from '@/components/common/loading';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { queryKeys } from '@/lib/queryKeys';
import type { AccountStatementDetail } from '@/lib/types/statement';

import { StatementTransactions } from '../components/statement-transactions';

/**
 * 往来账单交易记录页面
 * 仅展示指定账单的交易明细（全屏表格）
 */
export default function StatementTransactionsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string | undefined;

  const fetchStatementDetail = async (): Promise<AccountStatementDetail> => {
    if (!id) {
      throw new Error('账单ID不能为空');
    }

    const response = await fetch(`/api/finance/statements/${id}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '获取账单详情失败');
    }
    const result = await response.json();
    return result.data as AccountStatementDetail;
  };

  const {
    data: statement,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AccountStatementDetail>({
    queryKey: [...queryKeys.finance.statement(id ?? ''), 'transactions-only'],
    queryFn: fetchStatementDetail,
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });

  if (!id) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/finance/statements')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回往来账单列表
          </Button>
          <ErrorMessage
            title="缺少账单信息"
            message="无法识别往来账单ID，请从列表重新进入。"
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <ContentLoading text="加载交易记录..." />;
  }

  if (isError || !statement) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/finance/statements/${id}`)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回账单详情
            </Button>
            <h1 className="text-2xl font-semibold">往来账交易记录</h1>
          </div>
          <ErrorMessage
            title="加载失败"
            message={
              error instanceof Error ? error.message : '获取交易记录失败'
            }
            onRetry={() => refetch()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="mx-auto w-full max-w-[1600px] space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/finance/statements/${id}`)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回账单详情
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">往来账交易记录</h1>
              <p className="text-muted-foreground text-sm">
                {statement.entity?.name ?? statement.entityName}
              </p>
            </div>
          </div>
        </div>

        {/* 全屏交易表 */}
        <StatementTransactions transactions={statement.transactions} />
      </div>
    </div>
  );
}
