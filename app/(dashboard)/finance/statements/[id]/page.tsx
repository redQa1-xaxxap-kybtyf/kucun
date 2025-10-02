'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';

import { StatementBasicInfo } from './components/statement-basic-info';
import { StatementFinancialSummary } from './components/statement-financial-summary';
import { StatementHeader } from './components/statement-header';
import { StatementStatistics } from './components/statement-statistics';
import { StatementTransactions } from './components/statement-transactions';

interface StatementDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

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
export default function StatementDetailPage({
  params,
}: StatementDetailPageProps) {
  const router = useRouter();
  const [id, setId] = React.useState<string>('');

  // 解析 params
  React.useEffect(() => {
    params.then(resolvedParams => {
      setId(resolvedParams.id);
    });
  }, [params]);

  // API 调用函数
  const fetchStatementDetail = async (): Promise<StatementDetail> => {
    if (!id) {throw new Error('ID 不能为空');}

    const response = await fetch(`/api/statements/${id}`);
    if (!response.ok) {
      throw new Error('获取账单详情失败');
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
  } = useQuery({
    queryKey: ['statement-detail', id],
    queryFn: fetchStatementDetail,
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5分钟
  });

  // 加载状态
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div className="animate-pulse">
            <div className="h-8 w-48 rounded bg-gray-200"></div>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="h-64 animate-pulse rounded bg-gray-200"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  // 错误状态
  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
        </div>
        <div className="py-8 text-center">
          <p className="text-red-600">
            加载失败: {error?.message || '未知错误'}
          </p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="mt-2"
          >
            重试
          </Button>
        </div>
      </div>
    );
  }

  // 数据不存在
  if (!statement) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
        </div>
        <div className="py-8 text-center">
          <p className="text-muted-foreground">账单不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <StatementHeader
        name={statement.name}
        type={statement.type}
        status={statement.status}
      />

      {/* 基本信息和统计 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <StatementBasicInfo
          contact={statement.contact}
          creditLimit={statement.creditLimit}
          paymentTerms={statement.paymentTerms}
          lastTransactionDate={statement.lastTransactionDate}
          lastPaymentDate={statement.lastPaymentDate}
        />

        <StatementFinancialSummary
          totalOrders={statement.totalOrders}
          totalAmount={statement.totalAmount}
          paidAmount={statement.paidAmount}
          pendingAmount={statement.pendingAmount}
          overdueAmount={statement.overdueAmount}
        />

        <StatementStatistics summary={statement.summary} />
      </div>

      {/* 交易明细 */}
      <StatementTransactions transactions={statement.transactions} />
    </div>
  );
}
