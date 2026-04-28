'use client';

// 客户对账单页面 - 客户端组件

import {
  ArrowUpRight,
  ChevronRight,
  FileText,
  History,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useCustomerStatementStatistics,
  useCustomerStatements,
} from '@/lib/api/customer-statements';
import type {
  CustomerStatementListItem,
  CustomerStatementQuery,
  CustomerStatementSummary,
} from '@/lib/types/customer-statement';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface CustomerStatementsPageClientProps {
  initialParams?: CustomerStatementQuery;
}

export function CustomerStatementsPageClient({
  initialParams = {},
}: CustomerStatementsPageClientProps) {
  const router = useRouter();
  // 查询参数状态
  const [queryParams, setQueryParams] =
    useState<CustomerStatementQuery>(initialParams);

  // 使用TanStack Query获取数据
  const {
    data,
    isLoading,
    error: _error,
  } = useCustomerStatements(queryParams, {
    enabled: true,
  });

  const statements = data?.statements ?? [];
  const pagination = data?.pagination;

  const {
    data: statisticsData,
    isLoading: statisticsLoading,
    error: _statisticsError,
  } = useCustomerStatementStatistics();

  const getRefundMetrics = (summary: CustomerStatementSummary) => {
    const totalReturnAmount = Number(
      summary.receivables.salesReturnAmount ?? 0
    );
    const totalRefundProcessed = Number(
      summary.receivables.refundProcessed ?? summary.receivables.refundPaid ?? 0
    );
    const pendingRefundAmount =
      summary.receivables.refundPending !== undefined
        ? Number(summary.receivables.refundPending)
        : Math.max(0, totalReturnAmount - totalRefundProcessed);

    return {
      totalReturnAmount,
      totalRefundPaid: totalRefundProcessed,
      pendingRefundAmount,
    };
  };

  const getReceivableOverview = (summary: CustomerStatementSummary) => {
    const salesAmount = Number(summary.receivables.salesAmount ?? 0);
    const salesReturnAmount = Number(
      summary.receivables.salesReturnAmount ?? 0
    );
    const paymentReceived = Number(summary.receivables.paymentReceived ?? 0);
    const prepaymentReceived = Number(
      summary.receivables.prepaymentReceived ?? 0
    );
    const refundProcessed = Number(
      summary.receivables.refundProcessed ?? summary.receivables.refundPaid ?? 0
    );

    const netSales = salesAmount - salesReturnAmount;
    const totalReceipts = paymentReceived + prepaymentReceived;
    const netReceipts = totalReceipts - refundProcessed;

    return {
      netSales,
      netReceipts,
      receivableBalance: summary.receivables.receivableBalance,
    };
  };

  const fallbackTotals = statements.reduce<{
    receivable: number;
    payable: number;
    net: number;
    refundPending: number;
    returnAmount: number;
    refundPaid: number;
  }>(
    (totals, statement) => {
      const refundMetrics = getRefundMetrics(statement.summary);
      return {
        receivable:
          totals.receivable + statement.summary.receivables.receivableBalance,
        payable: totals.payable + statement.summary.payables.payableBalance,
        net: totals.net + statement.summary.netBalance,
        refundPending: totals.refundPending + refundMetrics.pendingRefundAmount,
        returnAmount: totals.returnAmount + refundMetrics.totalReturnAmount,
        refundPaid: totals.refundPaid + refundMetrics.totalRefundPaid,
      };
    },
    {
      receivable: 0,
      payable: 0,
      net: 0,
      refundPending: 0,
      returnAmount: 0,
      refundPaid: 0,
    }
  );

  const totalReceivableBalance =
    statisticsData?.totalReceivableBalance ?? fallbackTotals.receivable;
  const totalPayableBalance =
    statisticsData?.totalPayableBalance ?? fallbackTotals.payable;
  const totalNetBalance = statisticsData?.totalNetBalance ?? fallbackTotals.net;
  const totalPendingRefundBalance =
    statisticsData?.totalPendingRefundBalance ?? fallbackTotals.refundPending;
  const _totalReturnAmount =
    statisticsData?.totalReturnAmount ?? fallbackTotals.returnAmount;
  const totalRefundPaidAmount =
    statisticsData?.totalRefundPaidAmount ?? fallbackTotals.refundPaid;

  // 处理搜索
  const handleSearch = (customerName: string) => {
    setQueryParams(prev => ({
      ...prev,
      customerName,
      page: 1,
    }));
  };

  // 处理余额类型筛选
  const handleBalanceTypeChange = (
    balanceType: 'receivable' | 'payable' | 'all'
  ) => {
    setQueryParams(prev => ({
      ...prev,
      balanceType,
      page: 1,
    }));
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    setQueryParams(prev => ({
      ...prev,
      page,
    }));
  };

  // 格式化余额显示
  const formatBalance = (balance: number) => {
    if (balance > 0) {
      return (
        <span className="font-semibold text-[hsl(var(--color-success))]">
          {formatCurrency(balance)}
        </span>
      );
    } else if (balance < 0) {
      return (
        <span className="font-semibold text-[hsl(var(--color-error))]">
          {formatCurrency(balance)}
        </span>
      );
    }
    return (
      <span className="text-[hsl(var(--color-text-tertiary))]">
        {formatCurrency(0)}
      </span>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="客户往来明细"
          description="按客户查看应收、应付、退款和往来净额，适合逐个客户核对。"
          icon={<FileText className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-primary))"
          actions={
            <Button
              variant="outline"
              size="lg"
              asChild
              className="h-11 shadow-[var(--shadow-light)]"
            >
              <Link href="/finance/statements">查看往来总览</Link>
            </Button>
          }
        />

        {/* 筛选控制台 */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          {/* 检索输入框 */}
          <div className="group relative flex-1">
            <Input
              placeholder="搜索客户名称或电话"
              value={queryParams.customerName || ''}
              onChange={e => handleSearch(e.target.value)}
              className="h-11 rounded-lg border-[hsl(var(--color-border-primary))] bg-white pl-10"
            />
            <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[hsl(var(--color-text-tertiary))]" />
          </div>

          <div className="relative w-full sm:w-[220px]">
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[hsl(var(--color-text-tertiary))]" />
            <select
              value={queryParams.balanceType || 'all'}
              onChange={e =>
                handleBalanceTypeChange(
                  e.target.value as 'receivable' | 'payable' | 'all'
                )
              }
              className="h-11 w-full rounded-lg border border-[hsl(var(--color-border-primary))] bg-white pr-8 pl-10 text-sm focus:ring-2 focus:ring-[hsl(var(--color-primary-light))] focus:outline-hidden"
              aria-label="余额维度筛选"
            >
              <option value="all">全部客户</option>
              <option value="receivable">仅看待收款</option>
              <option value="payable">仅看待付款</option>
            </select>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-border bg-card p-4 text-emerald-600 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500">
                  应收账款余额
                </h3>
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="text-2xl font-semibold text-slate-900">
                {statisticsLoading
                  ? '---'
                  : formatCurrency(totalReceivableBalance)}
              </div>
              <p className="text-xs font-medium tracking-normal text-slate-500">
                待回收货款总额
              </p>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-4 text-rose-600 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500">
                  应付账款余额
                </h3>
                <TrendingDown className="h-5 w-5" />
              </div>
              <div className="text-2xl font-semibold text-slate-900">
                {statisticsLoading
                  ? '---'
                  : formatCurrency(totalPayableBalance)}
              </div>
              <p className="text-xs font-medium tracking-normal text-slate-500">
                待支付货款总额
              </p>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-4 text-amber-600 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500">
                  总应退金额
                </h3>
                <History className="h-5 w-5" />
              </div>
              <div className="text-2xl font-semibold text-slate-900">
                {statisticsLoading
                  ? '---'
                  : formatCurrency(totalPendingRefundBalance)}
              </div>
              <div className="flex items-center gap-2 text-xs font-medium tracking-normal text-slate-500">
                已处理退款 {formatCurrency(totalRefundPaidAmount)}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-4 text-slate-900 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500">
                  往来净额
                </h3>
                <Wallet className="h-5 w-5 text-slate-400" />
              </div>
              <div className="text-2xl font-semibold text-slate-900">
                {statisticsLoading ? '---' : formatCurrency(totalNetBalance)}
              </div>
              <p className="text-xs font-medium tracking-normal text-slate-500">
                应收减应付结余
              </p>
            </div>
          </div>
        </div>

        {/* 对账单列表 */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-semibold text-slate-900">
              客户往来明细
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <History className="h-3.5 w-3.5" />
              数据实时更新
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-md border border-border bg-card">
              <div className="flex flex-col items-center gap-4">
                <div className="relative h-16 w-16">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                  <div className="absolute inset-0 animate-spin rounded-full border-4 border-slate-900 border-t-transparent" />
                </div>
                <p className="text-sm font-medium text-slate-500">
                  正在加载客户往来数据...
                </p>
              </div>
            </div>
          ) : statements.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-200 bg-card py-16">
              <FileText className="mb-4 h-12 w-12 text-slate-200" />
              <p className="text-sm font-medium text-slate-500">
                暂无客户往来记录
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {statements.map((statement: CustomerStatementListItem) => {
                const refundMetrics = getRefundMetrics(statement.summary);
                const receivableOverview = getReceivableOverview(
                  statement.summary
                );
                const netBalance = statement.summary.netBalance;

                return (
                  <div
                    key={statement.customerId}
                    onClick={() =>
                      router.push(
                        `/finance/customer-statements/${statement.customerId}`
                      )
                    }
                    className="group cursor-pointer rounded-md border border-border bg-card p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50/50"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      {/* Left: Identity */}
                      <div className="flex items-center gap-3 lg:min-w-[260px]">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                          <User className="h-5 w-5" />
                        </div>
                        <div className="space-y-1.5">
                          <h3 className="text-base font-semibold text-slate-900 transition-colors group-hover:text-blue-600">
                            {statement.customerName}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
                              <Wallet className="h-3 w-3" />
                              {statement.customerPhone || '未留联系方式'}
                            </div>
                            <span className="text-xs font-medium tracking-normal text-slate-400">
                              客户编号: {statement.customerId.slice(-6)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Financial Insight Grid */}
                      <div className="grid flex-1 grid-cols-2 gap-3 border-slate-100 lg:border-x lg:px-6 xl:grid-cols-4">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-500">
                            应收金额
                          </span>
                          <p className="text-lg font-semibold text-emerald-600">
                            {formatCurrency(
                              statement.summary.receivables.receivableBalance
                            )}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-500">
                            应付金额
                          </span>
                          <p className="text-lg font-semibold text-rose-600">
                            {formatCurrency(
                              statement.summary.payables.payableBalance
                            )}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-500">
                            往来净额
                          </span>
                          <div
                            className={cn(
                              'text-lg font-semibold',
                              netBalance > 0
                                ? 'text-emerald-600'
                                : netBalance < 0
                                  ? 'text-rose-600'
                                  : 'text-slate-400'
                            )}
                          >
                            {formatBalance(netBalance)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-500">
                            待退款
                          </span>
                          <p
                            className={cn(
                              'text-lg font-semibold',
                              refundMetrics.pendingRefundAmount > 0
                                ? 'text-amber-600'
                                : 'text-slate-300'
                            )}
                          >
                            {formatCurrency(refundMetrics.pendingRefundAmount)}
                          </p>
                        </div>
                      </div>

                      {/* Right: Reconciliation Detail Tooltip Area */}
                      <div className="flex items-center gap-3 lg:min-w-[240px] lg:justify-end">
                        <div className="flex flex-col items-end gap-1.5 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="font-medium text-slate-500">
                              净销售额
                            </span>
                            <span className="font-semibold text-slate-700">
                              {formatCurrency(receivableOverview.netSales)}
                            </span>
                          </div>
                          <div className="flex w-full items-center justify-between gap-4 border-t border-slate-200/50 pt-1">
                            <span className="font-medium text-slate-500">
                              净收款
                            </span>
                            <span className="font-semibold text-slate-700">
                              {formatCurrency(receivableOverview.netReceipts)}
                            </span>
                          </div>
                        </div>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-md text-slate-400 transition-colors group-hover:text-slate-900"
                        >
                          <ChevronRight className="h-6 w-6" />
                        </Button>
                      </div>
                    </div>

                    {/* Footer: Metadata & Audit Indicators */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          <History className="h-3.5 w-3.5 text-slate-400" />
                          最后交易时间{' '}
                          <span className="ml-1 text-slate-900">
                            {statement.lastTransactionDate
                              ? formatDate(statement.lastTransactionDate)
                            : '--'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                          交易笔数{' '}
                          <span className="ml-1 text-blue-600">
                            {statement.transactionCount} 笔
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-400">
                          数据已更新
                        </span>
                        <div className="flex h-3 w-3 items-center justify-center rounded-sm bg-emerald-500/20">
                          <div className="h-1 w-1 rounded-full bg-emerald-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 分页 */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 sm:flex-row">
            <div className="text-xs font-bold text-slate-500">
              第 <span className="text-slate-900">{pagination.page}</span> 页 /
              共 {pagination.totalPages} 页 — {pagination.total} 条记录
            </div>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="lg"
                disabled={pagination.page === 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                className="h-10 rounded-md border bg-white font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-900 hover:text-white disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-900"
              >
                上一页
              </Button>
              <Button
                variant="ghost"
                size="lg"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
                className="h-10 rounded-md border bg-white font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-900 hover:text-white disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-900"
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
