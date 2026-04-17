'use client';

import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Layers,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { useFinanceExport } from '@/hooks/use-finance-export';
import { useCustomerStatementDetail } from '@/lib/api/customer-statements';
import {
  CUSTOMER_STATEMENT_TRANSACTION_TYPES,
  type CustomerStatementTransaction,
} from '@/lib/types/customer-statement';
import { cn, formatCurrency } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/utils/datetime';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

const DateRangePicker = dynamic(
  () =>
    import('@/components/ui/date-range-picker').then(
      mod => mod.DateRangePicker
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-10 w-full animate-pulse rounded-md bg-slate-100" />
    ),
  }
);

const DEFAULT_RANGE_DAYS = 30;

function formatTransactionStatus(status: string): string {
  const STATUS_LABELS: Record<string, string> = {
    pending: '待确认到账',
    confirmed: '已到账',
    cancelled: '已取消',
    completed: '已完成',
    processing: '待退款',
    approved: '已审核',
    rejected: '已关闭',
    draft: '草稿',
    shipped: '已发货',
    submitted: '已提交',
    applied: '已入账',
  };

  return STATUS_LABELS[status] ?? status;
}

export default function CustomerStatementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const customerId = params.customerId as string | undefined;

  const today = new Date();
  const defaultEndDate = formatDate(today);
  const defaultStartDate = (() => {
    const start = new Date(today);
    start.setDate(start.getDate() - DEFAULT_RANGE_DAYS);
    return formatDate(start);
  })();

  const queryStart = searchParams.get('startDate') ?? defaultStartDate;
  const queryEnd = searchParams.get('endDate') ?? defaultEndDate;

  const [dateRange, setDateRange] = useState({
    startDate: queryStart,
    endDate: queryEnd,
  });

  useEffect(() => {
    setDateRange(prev => {
      if (prev.startDate === queryStart && prev.endDate === queryEnd) {
        return prev;
      }
      return {
        startDate: queryStart,
        endDate: queryEnd,
      };
    });
  }, [queryStart, queryEnd]);

  useEffect(() => {
    if (!customerId) return;

    const currentStart = searchParams.get('startDate');
    const currentEnd = searchParams.get('endDate');

    if (
      currentStart === dateRange.startDate &&
      currentEnd === dateRange.endDate
    )
      return;

    const params = new URLSearchParams();
    if (dateRange.startDate) params.set('startDate', dateRange.startDate);
    if (dateRange.endDate) params.set('endDate', dateRange.endDate);

    const queryString = params.toString();

    router.replace(
      queryString
        ? `/finance/customer-statements/${customerId}?${queryString}`
        : `/finance/customer-statements/${customerId}`,
      { scroll: false }
    );
  }, [
    customerId,
    dateRange.startDate,
    dateRange.endDate,
    router,
    searchParams,
  ]);

  const isRangeValid =
    Boolean(dateRange.startDate) &&
    Boolean(dateRange.endDate) &&
    new Date(dateRange.startDate).getTime() <=
      new Date(dateRange.endDate).getTime();

  const typeLabelMap = useMemo(
    () =>
      CUSTOMER_STATEMENT_TRANSACTION_TYPES.reduce(
        (acc, item) => {
          acc[item.type] = item.label;
          return acc;
        },
        {} as Record<string, string>
      ),
    []
  );

  const { exportData, isExporting } = useFinanceExport();

  const {
    data: statementDetail,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useCustomerStatementDetail(
    customerId ?? '',
    dateRange.startDate,
    dateRange.endDate,
    {
      enabled: Boolean(customerId && isRangeValid),
    }
  );

  const refundSummary = useMemo(() => {
    const receivables = statementDetail?.summary?.receivables;
    if (receivables) {
      const totalReturnAmount = Number(receivables.salesReturnAmount ?? 0);
      const totalRefundProcessed = Number(
        receivables.refundProcessed ?? receivables.refundPaid ?? 0
      );
      const pendingRefundAmount =
        receivables.refundPending !== undefined
          ? Number(receivables.refundPending)
          : Math.max(0, totalReturnAmount - totalRefundProcessed);

      return {
        totalReturnAmount,
        totalRefundPaid: totalRefundProcessed,
        pendingRefundAmount,
      };
    }

    if (!statementDetail?.transactions) {
      return {
        totalReturnAmount: 0,
        totalRefundPaid: 0,
        pendingRefundAmount: 0,
      };
    }

    return statementDetail.transactions.reduce(
      (acc, transaction) => {
        if (transaction.transactionType === 'sales_return') {
          acc.totalReturnAmount += Number(transaction.creditAmount || 0);
        }
        if (transaction.transactionType === 'refund_out') {
          acc.totalRefundPaid += Number(transaction.debitAmount || 0);
        }
        acc.pendingRefundAmount = Math.max(
          0,
          acc.totalReturnAmount - acc.totalRefundPaid
        );
        return acc;
      },
      { totalReturnAmount: 0, totalRefundPaid: 0, pendingRefundAmount: 0 }
    );
  }, [statementDetail?.summary?.receivables, statementDetail?.transactions]);

  const receivableOverview = useMemo(() => {
    const receivables = statementDetail?.summary?.receivables;
    if (!receivables) {
      return {
        salesAmount: 0,
        salesReturnAmount: 0,
        netSales: 0,
        paymentReceived: 0,
        prepaymentReceived: 0,
        totalReceipts: 0,
        refundProcessed: 0,
        netReceipts: 0,
      };
    }

    const salesAmount = Number(receivables.salesAmount ?? 0);
    const salesReturnAmount = Number(receivables.salesReturnAmount ?? 0);
    const paymentReceived = Number(receivables.paymentReceived ?? 0);
    const prepaymentReceived = Number(receivables.prepaymentReceived ?? 0);
    const refundProcessed = Number(
      receivables.refundProcessed ?? receivables.refundPaid ?? 0
    );

    const netSales = salesAmount - salesReturnAmount;
    const totalReceipts = paymentReceived + prepaymentReceived;
    const netReceipts = totalReceipts - refundProcessed;

    return {
      salesAmount,
      salesReturnAmount,
      netSales,
      paymentReceived,
      prepaymentReceived,
      totalReceipts,
      refundProcessed,
      netReceipts,
    };
  }, [statementDetail?.summary?.receivables]);

  const payableOverview = useMemo(() => {
    const payables = statementDetail?.summary?.payables;
    if (!payables) return { totalGenerated: 0, totalPaid: 0 };

    const purchaseAmount = Number(payables.purchaseAmount ?? 0);
    const purchaseReturnAmount = Number(payables.purchaseReturnAmount ?? 0);
    const refundReceived = Number(payables.refundReceived ?? 0);
    const paymentPaid = Number(payables.paymentPaid ?? 0);
    const prepaymentPaid = Number(payables.prepaymentPaid ?? 0);

    const totalGenerated =
      purchaseAmount - purchaseReturnAmount - refundReceived;
    const totalPaid = paymentPaid + prepaymentPaid;

    return { totalGenerated, totalPaid };
  }, [statementDetail?.summary?.payables]);

  if (!customerId) {
    return (
      <ErrorMessage
        title="缺少客户信息"
        message="无法识别客户ID，请从列表重新进入。"
        onRetry={() => router.push('/finance/customer-statements')}
      />
    );
  }

  if (!isRangeValid) {
    return (
      <div className="mx-auto max-w-[1680px] space-y-4 p-10">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回客户往来
        </Button>
        <ErrorMessage
          title="日期范围无效"
          message="开始日期不能晚于结束日期，请调整后重试。"
          variant="warning"
        />
      </div>
    );
  }

  if (isLoading) return <ContentLoading text="正在加载客户对账单..." />;

  if (error || !statementDetail) {
    return (
      <div className="mx-auto max-w-[1680px] space-y-4 p-10">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回客户往来
        </Button>
        <ErrorMessage
          title={error ? '加载失败' : '暂无数据'}
          message={getFriendlyErrorMessage(
            error,
            '暂时没有查到相关往来记录，请稍后重试'
          )}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const handleExport = async () => {
    try {
      await exportData('/api/finance/customer-statements/export', {
        format: 'excel',
        filters: {
          customerId: statementDetail.customerId,
          startDate: statementDetail.periodStart,
          endDate: statementDetail.periodEnd,
        },
      });
    } catch {}
  };

  const { summary, transactions } = statementDetail;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1680px] space-y-12 p-4 transition-all duration-500 lg:p-10 xl:p-14">
        {/* Identity Wall Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] border border-white bg-white/60 p-8 shadow-sm backdrop-blur-xl transition-all duration-500 hover:shadow-xl">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-blue-50/50 opacity-40 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-50/30 opacity-40 blur-3xl" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="h-14 w-14 rounded-2xl bg-white shadow-sm transition-all hover:bg-slate-900 hover:text-white active:scale-90"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-4">
                  <h1 className="text-4xl font-semibold tracking-tighter text-slate-900">
                    {statementDetail.customerName}
                  </h1>
                  <Badge className="rounded-full border-none bg-emerald-500/10 px-4 py-1.5 text-[10px] font-semibold text-emerald-600 ring-1 ring-emerald-500/20">
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                    往来客户
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    <span className="text-[10px] font-semibold text-slate-400">
                      统计期间
                    </span>
                    <span className="text-sm font-semibold text-slate-700">
                      {formatDate(statementDetail.periodStart)} —{' '}
                      {formatDate(statementDetail.periodEnd)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 border-l border-slate-200 pl-6">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    <span className="text-[10px] font-semibold text-slate-400">
                      最后对账
                    </span>
                    <span className="text-sm font-semibold text-slate-700">
                      {formatDateTime(statementDetail.generatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="lg"
                disabled={isFetching}
                onClick={() => refetch()}
                className="h-14 rounded-2xl border border-white bg-white/60 px-8 font-semibold text-slate-900 shadow-sm transition-all hover:bg-white active:scale-95"
              >
                <RefreshCw
                  className={cn('mr-2 h-5 w-5', isFetching && 'animate-spin')}
                />
                刷新对账单
              </Button>
              <Button
                size="lg"
                disabled={isExporting}
                onClick={handleExport}
                className="h-14 rounded-2xl bg-slate-900 px-10 font-semibold text-white shadow-xl transition-all hover:shadow-slate-200 active:scale-95"
              >
                <Download className="mr-2 h-5 w-5" />
                {isExporting ? '正在生成...' : '导出当前对账单'}
              </Button>
            </div>
          </div>
        </div>

        {/* Audit Control Bar */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="group max-w-2xl flex-1">
            <div className="mb-4 flex items-center gap-2 px-1 text-[10px] font-semibold tracking-[0.2em] text-slate-300">
              <Calendar className="h-3 w-3" />
              对账日期范围
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <div className="flex-1 rounded-[1.5rem] border border-white bg-white/60 px-4 py-1 shadow-sm backdrop-blur-md transition-all group-hover:bg-white/80 group-hover:shadow-md">
                <DateRangePicker
                  value={{
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                  }}
                  onChange={({ startDate, endDate }) => {
                    setDateRange({
                      startDate: startDate || defaultStartDate,
                      endDate: endDate || defaultEndDate,
                    });
                  }}
                  label=""
                  maxDate={today}
                  showPresets={true}
                  showClearButton={false}
                  className="border-none bg-transparent shadow-none"
                />
              </div>
              <Button
                variant="ghost"
                size="lg"
                onClick={() =>
                  setDateRange({
                    startDate: defaultStartDate,
                    endDate: defaultEndDate,
                  })
                }
                className="h-14 rounded-[1.5rem] border border-white bg-white/60 px-10 font-semibold text-slate-400 shadow-sm transition-all hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
              >
                清空
              </Button>
            </div>
          </div>
        </div>

        {/* Metrics Matrix */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {[
            {
              label: '期初余额',
              value: statementDetail.openingBalance,
              subValue: `${formatDate(statementDetail.periodStart)} 结余`,
              color: 'blue',
              icon: Layers,
            },
            {
              label: '待退款',
              value: refundSummary.pendingRefundAmount,
              subValue: `累计退货 ${formatCurrency(refundSummary.totalReturnAmount)}`,
              color: 'amber',
              icon: AlertCircle,
            },
            {
              label: '待收金额',
              value: summary.receivables.receivableBalance,
              subValue: `净销售额 ${formatCurrency(receivableOverview.netSales)}`,
              color: 'emerald',
              icon: TrendingUp,
            },
            {
              label: '待付金额',
              value: summary.payables.payableBalance,
              subValue: `应付款合计 ${formatCurrency(payableOverview.totalGenerated)}`,
              color: 'rose',
              icon: TrendingDown,
            },
            {
              label: '期末余额',
              value: statementDetail.closingBalance,
              subValue: `往来净额 ${formatCurrency(summary.netBalance)}`,
              color: 'slate',
              icon: Wallet,
            },
          ].map(metric => (
            <div
              key={metric.label}
              className="group relative overflow-hidden rounded-[2rem] border border-white bg-white/60 p-6 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:bg-white hover:shadow-2xl"
            >
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400">
                    {metric.label}
                  </span>
                  <metric.icon
                    className={cn('h-4 w-4', `text-${metric.color}-500/50`)}
                  />
                </div>
                <div
                  className={cn(
                    'text-2xl font-semibold tracking-tighter',
                    metric.color === 'emerald'
                      ? 'text-emerald-600'
                      : metric.color === 'rose'
                        ? 'text-rose-600'
                        : 'text-slate-900'
                  )}
                >
                  {formatCurrency(metric.value)}
                </div>
                <div className="text-[10px] font-bold text-slate-400">
                  {metric.subValue}
                </div>
              </div>
              <div
                className={cn(
                  'absolute -right-6 -bottom-6 h-20 w-20 rounded-full opacity-10 blur-[30px] transition-opacity group-hover:opacity-20',
                  `bg-${metric.color}-400`
                )}
              />
            </div>
          ))}
        </div>

        {/* Audit Stream */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              账务流水明细
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-300">
              <Clock className="h-3 w-3" />
              共查得 {transactions.length} 条记录
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-slate-200 bg-white/20 py-24">
              <FileText className="mb-4 h-12 w-12 text-slate-200" />
              <p className="text-sm font-semibold text-slate-400">
                当前期间暂无往来记录
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {transactions.map((tx: CustomerStatementTransaction) => (
                <div
                  key={tx.id}
                  className="group relative overflow-hidden rounded-2xl border border-white bg-white/60 p-5 backdrop-blur-md transition-all duration-300 hover:bg-white hover:shadow-lg"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                    <div className="flex items-center gap-4 lg:min-w-[200px]">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 transition-colors group-hover:border-slate-800 group-hover:bg-slate-900">
                        <Layers className="h-6 w-6 text-slate-400 group-hover:text-white" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-slate-400">
                          {typeLabelMap[tx.transactionType] ||
                            tx.transactionType}
                        </div>
                        <div className="text-sm font-bold text-slate-700">
                          {formatDateTime(tx.transactionDate, 'date')}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">
                          单号: {tx.referenceNumber}
                        </span>
                        <Badge
                          variant="secondary"
                          className="bg-slate-100/50 py-0.5 text-[9px] font-semibold hover:bg-slate-100"
                        >
                          {formatTransactionStatus(tx.status)}
                        </Badge>
                      </div>
                      <p className="h-4 overflow-hidden text-xs font-medium text-ellipsis text-slate-500">
                        {tx.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-8 lg:min-w-[360px] lg:border-l lg:border-slate-100 lg:pl-10">
                      <div className="space-y-1">
                        <span className="text-[9px] font-semibold text-slate-300">
                          本次变动
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span
                            className={cn(
                              'text-sm font-semibold',
                              tx.debitAmount > 0
                                ? 'text-emerald-600'
                                : tx.creditAmount > 0
                                  ? 'text-rose-600'
                                  : 'text-slate-400'
                            )}
                          >
                            {tx.debitAmount > 0
                              ? `+${formatCurrency(tx.debitAmount)}`
                              : tx.creditAmount > 0
                                ? `-${formatCurrency(tx.creditAmount)}`
                                : '￥0.00'}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-semibold text-slate-300">
                          余额
                        </span>
                        <div className="text-sm font-semibold text-slate-900">
                          {formatCurrency(tx.balance)}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end lg:min-w-[40px]">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-slate-200 transition-all group-hover:text-slate-900"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
