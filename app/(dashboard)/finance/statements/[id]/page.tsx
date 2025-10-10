'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { ContentLoading } from '@/components/common/loading';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/queryKeys';

import { StatementBasicInfo } from './components/statement-basic-info';
import { StatementFinancialSummary } from './components/statement-financial-summary';
import { StatementHeader } from './components/statement-header';
import { StatementStatistics } from './components/statement-statistics';
import { StatementTransactions } from './components/statement-transactions';

// 数据类型定义
interface StatementDetail {
  id: string;
  name: string;
  type: 'customer' | 'supplier';
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  creditLimit: number;
  paymentTerms: string;
  status: string;
  lastTransactionDate: string | null;
  lastPaymentDate: string | null;
  contact: {
    phone: string;
    address: string;
  };
  transactions: Array<{
    id: string;
    type: string;
    referenceNumber: string;
    amount: number;
    balance: number;
    description: string;
    transactionDate: string;
    dueDate?: string;
    status: string;
  }>;
  summary: {
    currentMonthAmount: number;
    lastMonthAmount: number;
    averageMonthlyAmount: number;
    paymentRate: number;
    averagePaymentDays: number;
  };
}

/**
 * 往来账单详情页面
 * 显示客户或供应商的详细账务往来信息
 */
export default function StatementDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // API 调用函数
  const fetchStatementDetail = async (): Promise<StatementDetail> => {
    if (!id) {
      throw new Error('ID 不能为空');
    }

    const response = await fetch(`/api/finance/statements/${id}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '获取账单详情失败');
    }
    const result = await response.json();
    return result.data;
  };

  // 使用 TanStack Query 获取数据
  const {
    data: statement,
    isLoading,
    isError,
    error,
  } = useQuery<StatementDetail>({
    queryKey: queryKeys.finance.statement(id),
    queryFn: fetchStatementDetail,
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  if (isError || !statement) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 p-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">加载失败</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {error instanceof Error ? error.message : '获取账单详情失败'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/finance/statements')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回列表
          </Button>
          <Button onClick={() => window.location.reload()}>重试</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面头部 */}
        <StatementHeader statement={statement} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 主要内容区域 */}
          <div className="space-y-6 lg:col-span-2">
            {/* 基本信息 */}
            <StatementBasicInfo statement={statement} />

            {/* 交易记录 */}
            <StatementTransactions transactions={statement.transactions} />
          </div>

          {/* 侧边栏 */}
          <div className="space-y-6">
            {/* 财务汇总 */}
            <StatementFinancialSummary statement={statement} />

            {/* 统计数据 */}
            <StatementStatistics summary={statement.summary} />
          </div>
        </div>
      </div>
    </div>
  );
}
