'use client';

// 客户对账单页面 - 客户端组件

import {
    ArrowUpRight,
    ChevronRight,
    Download,
    FileText,
    History,
    Search,
    SlidersHorizontal,
    TrendingDown,
    TrendingUp,
    User,
    Wallet
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
  const { data, isLoading, error } = useCustomerStatements(queryParams, {
    enabled: true,
  });

  const statements = data?.statements ?? [];
  const pagination = data?.pagination;

  const {
    data: statisticsData,
    isLoading: statisticsLoading,
    error: statisticsError,
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
  const totalReturnAmount =
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
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1680px] space-y-12 p-4 lg:p-10 xl:p-14 transition-all duration-500">
        
        {/* Identity Wall Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white/60 p-8 backdrop-blur-xl border border-white shadow-sm transition-all duration-500 hover:shadow-xl">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-50/50 blur-3xl" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-50/30 blur-3xl" />
          
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-2xl transition-transform hover:scale-110 duration-500">
                <FileText className="h-10 w-10" />
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-4xl font-black tracking-tighter text-slate-900">
                    客户对账单
                  </h1>
                  <div className="text-xs uppercase font-bold tracking-wider px-4 py-1.5 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200">
                    深度审计洞察
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-6">
                   <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                    <span className="uppercase text-xs tracking-wider text-slate-500">账户治理规范</span>
                    <span className="text-slate-600 font-bold">管理与客户之间的完整财务往来记录</span>
                   </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button
                size="lg"
                className="h-14 rounded-2xl bg-slate-900 font-black text-white shadow-xl hover:shadow-slate-200 transition-all active:scale-95 px-10"
              >
                <Download className="mr-2 h-5 w-5" />
                批量导出审计对账单
              </Button>
            </div>
          </div>
        </div>

        {/* 筛选控制台 */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
            {/* 检索输入框 */}
            <div className="relative flex-1 group">
               <Input
                 placeholder="检索客户名称、联系方式或 ID..."
                 value={queryParams.customerName || ''}
                 onChange={e => handleSearch(e.target.value)}
                 className="h-14 rounded-2xl border-white bg-white/60 pl-12 font-bold shadow-sm backdrop-blur-md transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/20 group-hover:shadow-md"
               />
               <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </div>

            {/* 余额维度筛选 */}
            <Select
              value={queryParams.balanceType || 'all'}
              onValueChange={value =>
                handleBalanceTypeChange(
                  value as 'receivable' | 'payable' | 'all'
                )
              }
            >
              <SelectTrigger className="h-14 w-full rounded-2xl border-white bg-white/60 font-bold shadow-sm backdrop-blur-md transition-all hover:bg-white sm:w-[240px]">
                <div className="flex items-center gap-2">
                   <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                   <SelectValue placeholder="余额维度筛选" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-2xl">
                <SelectItem value="all" className="rounded-xl font-bold py-3">查看全部账户</SelectItem>
                <SelectItem value="receivable" className="rounded-xl font-bold py-3 text-emerald-600">仅看应收余额</SelectItem>
                <SelectItem value="payable" className="rounded-xl font-bold py-3 text-rose-600">仅看应付余额</SelectItem>
              </SelectContent>
            </Select>
        </div>

        {/* 统计卡片 */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="group relative overflow-hidden rounded-[2rem] border border-white bg-white/60 p-8 backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 hover:bg-white text-emerald-600">
             <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                   <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">总应收余额</h3>
                   <TrendingUp className="h-5 w-5" />
                </div>
                <div className="text-3xl font-black tracking-tighter text-slate-900">
                  {statisticsLoading ? '---' : formatCurrency(totalReceivableBalance)}
                </div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-normal">活跃应收资产流</p>
             </div>
             <div className="absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-emerald-400 blur-[40px] opacity-10 group-hover:opacity-20 transition-opacity" />
          </div>

          <div className="group relative overflow-hidden rounded-[2rem] border border-white bg-white/60 p-8 backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 hover:bg-white text-rose-600">
             <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                   <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">总应付余额</h3>
                   <TrendingDown className="h-5 w-5" />
                </div>
                <div className="text-3xl font-black tracking-tighter text-slate-900">
                  {statisticsLoading ? '---' : formatCurrency(totalPayableBalance)}
                </div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-normal">累计应付债务总额</p>
             </div>
             <div className="absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-rose-400 blur-[40px] opacity-10 group-hover:opacity-20 transition-opacity" />
          </div>

          <div className="group relative overflow-hidden rounded-[2rem] border border-white bg-white/60 p-8 backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 hover:bg-white text-amber-600">
             <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                   <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">总应退金额</h3>
                   <History className="h-5 w-5" />
                </div>
                <div className="text-3xl font-black tracking-tighter text-slate-900">
                  {statisticsLoading ? '---' : formatCurrency(totalPendingRefundBalance)}
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-normal">
                  已处理退款 {formatCurrency(totalRefundPaidAmount)}
                </div>
             </div>
             <div className="absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-amber-400 blur-[40px] opacity-10 group-hover:opacity-20 transition-opacity" />
          </div>

          <div className="group relative overflow-hidden rounded-[2rem] border border-white bg-white/60 p-8 backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 hover:bg-white text-slate-900">
             <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                   <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">净资产头寸</h3>
                   <Wallet className="h-5 w-5 text-slate-400" />
                </div>
                <div className="text-3xl font-black tracking-tighter text-slate-900">
                  {statisticsLoading ? '---' : formatCurrency(totalNetBalance)}
                </div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-normal">净资产综合头寸</p>
             </div>
             <div className="absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-slate-900 blur-[40px] opacity-5 group-hover:opacity-10 transition-opacity" />
          </div>
        </div>

        {/* 对账单列表 */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">对账审计列表</h2>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
               <History className="h-3.5 w-3.5" />
               实时对账同步
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[400px] items-center justify-center rounded-[2.5rem] border border-white bg-white/40 backdrop-blur-md">
              <div className="flex flex-col items-center gap-4">
                <div className="relative h-16 w-16">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                  <div className="absolute inset-0 rounded-full border-4 border-slate-900 border-t-transparent animate-spin" />
                </div>
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">正在同步对账流...</p>
              </div>
            </div>
          ) : statements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 rounded-[2.5rem] border border-dashed border-slate-200 bg-white/20">
               <FileText className="h-12 w-12 text-slate-200 mb-4" />
               <p className="text-sm font-black text-slate-400 uppercase tracking-widest">暂无相关财务往来记录</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {statements.map((statement: CustomerStatementListItem) => {
                const refundMetrics = getRefundMetrics(statement.summary);
                const receivableOverview = getReceivableOverview(statement.summary);
                const netBalance = statement.summary.netBalance;

                return (
                  <div
                    key={statement.customerId}
                    onClick={() => router.push(`/finance/customer-statements/${statement.customerId}`)}
                    className="group relative overflow-hidden rounded-[2rem] border border-white bg-white/60 p-6 backdrop-blur-xl transition-all duration-500 hover:bg-white hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] hover:-translate-y-1 cursor-pointer"
                  >
                    <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
                      
                      {/* Left: Identity */}
                      <div className="flex items-center gap-5 min-w-[300px]">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl transition-transform group-hover:scale-110 duration-500">
                          <User className="h-8 w-8" />
                        </div>
                        <div className="space-y-1.5">
                          <h3 className="text-xl font-black tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                            {statement.customerName}
                          </h3>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 wy-1 border border-slate-200 text-xs font-bold text-slate-600">
                               <Wallet className="h-3 w-3" />
                               {statement.customerPhone || '未留联系方式'}
                            </div>
                            <span className="text-xs font-bold uppercase tracking-normal text-slate-400">ID: {statement.customerId.slice(-6)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Financial Insight Grid */}
                      <div className="grid flex-1 grid-cols-2 gap-6 border-slate-100 lg:border-x lg:px-8 xl:grid-cols-4">
                        <div className="space-y-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">应收金额</span>
                          <p className="text-lg font-black text-emerald-600">{formatCurrency(statement.summary.receivables.receivableBalance)}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">应付金额</span>
                          <p className="text-lg font-black text-rose-600">{formatCurrency(statement.summary.payables.payableBalance)}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">业务净值</span>
                          <div className={cn("text-lg font-black", netBalance > 0 ? "text-emerald-600" : netBalance < 0 ? "text-rose-600" : "text-slate-400")}>
                            {formatBalance(netBalance)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">待退余额</span>
                          <p className={cn("text-lg font-black", refundMetrics.pendingRefundAmount > 0 ? "text-amber-600" : "text-slate-300")}>
                            {formatCurrency(refundMetrics.pendingRefundAmount)}
                          </p>
                        </div>
                      </div>

                      {/* Right: Reconciliation Detail Tooltip Area */}
                      <div className="flex items-center gap-6 lg:min-w-[240px] lg:justify-end">
                        <div className="flex flex-col items-end gap-1.5 rounded-2xl bg-slate-50/50 px-4 py-3 border border-slate-100 text-sm transition-all group-hover:bg-slate-900 group-hover:border-slate-800">
                          <div className="flex items-center gap-4 justify-between w-full">
                            <span className="text-slate-500 group-hover:text-slate-400 font-bold transition-colors">净销流动</span>
                            <span className="font-black text-slate-700 group-hover:text-white transition-colors">{formatCurrency(receivableOverview.netSales)}</span>
                          </div>
                          <div className="flex items-center gap-4 justify-between w-full border-t border-slate-200/50 pt-1 group-hover:border-slate-700">
                            <span className="text-slate-500 group-hover:text-slate-400 font-bold transition-colors">净收结算</span>
                            <span className="font-black text-slate-700 group-hover:text-white transition-colors">{formatCurrency(receivableOverview.netReceipts)}</span>
                          </div>
                        </div>
                        
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10 rounded-xl text-slate-300 group-hover:text-slate-900 transition-all active:scale-90"
                        >
                          <ChevronRight className="h-6 w-6" />
                        </Button>
                      </div>
                    </div>

                    {/* Footer: Metadata & Audit Indicators */}
                    <div className="mt-8 flex items-center justify-between border-t border-slate-50 pt-5">
                        <div className="flex items-center gap-6">
                         <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                            <History className="h-3.5 w-3.5 text-slate-400" />
                            最后交易时间 <span className="text-slate-900 ml-1">{statement.lastTransactionDate ? formatDate(statement.lastTransactionDate) : '--'}</span>
                         </div>
                         <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                            <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                            交易笔数 <span className="text-blue-600 ml-1">{statement.transactionCount} 笔已审计</span>
                         </div>
                       </div>
                       
                       <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">安全审计已校验</span>
                          <div className="h-3 w-3 rounded-sm bg-emerald-500/20 flex items-center justify-center">
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
          <div className="flex flex-col gap-6 items-center justify-between border-t border-slate-100 pt-8 sm:flex-row">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              第 <span className="text-slate-900">{pagination.page}</span> 页 / 共 {pagination.totalPages} 页 — {pagination.total} 条记录已审计
            </div>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="lg"
                disabled={pagination.page === 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                className="h-12 rounded-xl bg-white font-black text-slate-900 shadow-sm border-none hover:bg-slate-900 hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-900"
              >
                上一页
              </Button>
              <Button
                variant="ghost"
                size="lg"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
                className="h-12 rounded-xl bg-white font-black text-slate-900 shadow-sm border-none hover:bg-slate-900 hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-900"
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
