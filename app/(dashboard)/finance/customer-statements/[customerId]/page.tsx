'use client';

import { format, subDays } from 'date-fns';
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
    Wallet
} from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { ErrorMessage } from '@/components/ui/error-message';
import { useFinanceExport } from '@/hooks/use-finance-export';
import { useCustomerStatementDetail } from '@/lib/api/customer-statements';
import {
    CUSTOMER_STATEMENT_TRANSACTION_TYPES,
    type CustomerStatementTransaction,
} from '@/lib/types/customer-statement';
import { cn, formatCurrency } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/utils/datetime';

const DEFAULT_RANGE_DAYS = 30;

function formatTransactionStatus(status: string): string {
  const STATUS_LABELS: Record<string, string> = {
    pending: '待确认',
    confirmed: '已确认',
    cancelled: '已取消',
    completed: '已完成',
    processing: '处理中',
    approved: '已审核',
    rejected: '已拒绝',
    draft: '草稿',
    shipped: '已发货',
    submitted: '已提交',
    applied: '已冲抵',
  };

  return STATUS_LABELS[status] ?? status;
}

export default function CustomerStatementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const customerId = params.customerId as string | undefined;

  const today = new Date();
  const defaultEndDate = format(today, 'yyyy-MM-dd');
  const defaultStartDate = format(
    subDays(today, DEFAULT_RANGE_DAYS),
    'yyyy-MM-dd'
  );

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

    if (currentStart === dateRange.startDate && currentEnd === dateRange.endDate) return;

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
  }, [customerId, dateRange.startDate, dateRange.endDate, router, searchParams]);

  const isRangeValid =
    Boolean(dateRange.startDate) &&
    Boolean(dateRange.endDate) &&
    new Date(dateRange.startDate).getTime() <= new Date(dateRange.endDate).getTime();

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
      return { totalReturnAmount: 0, totalRefundPaid: 0, pendingRefundAmount: 0 };
    }

    return statementDetail.transactions.reduce(
      (acc, transaction) => {
        if (transaction.transactionType === 'sales_return') {
          acc.totalReturnAmount += Number(transaction.creditAmount || 0);
        }
        if (transaction.transactionType === 'refund_out') {
          acc.totalRefundPaid += Number(transaction.debitAmount || 0);
        }
        acc.pendingRefundAmount = Math.max(0, acc.totalReturnAmount - acc.totalRefundPaid);
        return acc;
      },
      { totalReturnAmount: 0, totalRefundPaid: 0, pendingRefundAmount: 0 }
    );
  }, [statementDetail?.summary?.receivables, statementDetail?.transactions]);

  const receivableOverview = useMemo(() => {
    const receivables = statementDetail?.summary?.receivables;
    if (!receivables) {
      return {
        salesAmount: 0, salesReturnAmount: 0, netSales: 0,
        paymentReceived: 0, prepaymentReceived: 0, totalReceipts: 0,
        refundProcessed: 0, netReceipts: 0,
      };
    }

    const salesAmount = Number(receivables.salesAmount ?? 0);
    const salesReturnAmount = Number(receivables.salesReturnAmount ?? 0);
    const paymentReceived = Number(receivables.paymentReceived ?? 0);
    const prepaymentReceived = Number(receivables.prepaymentReceived ?? 0);
    const refundProcessed = Number(receivables.refundProcessed ?? receivables.refundPaid ?? 0);

    const netSales = salesAmount - salesReturnAmount;
    const totalReceipts = paymentReceived + prepaymentReceived;
    const netReceipts = totalReceipts - refundProcessed;

    return {
      salesAmount, salesReturnAmount, netSales,
      paymentReceived, prepaymentReceived, totalReceipts,
      refundProcessed, netReceipts,
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

    const totalGenerated = purchaseAmount - purchaseReturnAmount - refundReceived;
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
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回列表
        </Button>
        <ErrorMessage
          title="日期范围无效"
          message="开始日期不能晚于结束日期，请调整后重试。"
          variant="warning"
        />
      </div>
    );
  }

  if (isLoading) return <ContentLoading text="正在同步账务记录..." />;

  if (error || !statementDetail) {
    return (
      <div className="mx-auto max-w-[1680px] space-y-4 p-10">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回列表
        </Button>
        <ErrorMessage
          title={error ? "获取失败" : "暂无数据"}
          message={error instanceof Error ? error.message : "未发现相关对账记录"}
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
      <div className="mx-auto max-w-[1680px] space-y-12 p-4 lg:p-10 xl:p-14 transition-all duration-500">
        
        {/* Identity Wall Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white/60 p-8 backdrop-blur-xl border border-white shadow-sm transition-all duration-500 hover:shadow-xl">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-50/50 blur-3xl opacity-40" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-50/30 blur-3xl opacity-40" />
          
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="h-14 w-14 rounded-2xl bg-white shadow-sm hover:bg-slate-900 hover:text-white transition-all active:scale-90"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-4">
                  <h1 className="text-4xl font-black tracking-tighter text-slate-900">
                    {statementDetail.customerName}
                  </h1>
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-none px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ring-1 ring-emerald-500/20">
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                    实名认证往来账户
                  </Badge>
                </div>
                
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">审计周期</span>
                    <span className="text-sm font-black text-slate-700">
                      {formatDate(statementDetail.periodStart)} — {formatDate(statementDetail.periodEnd)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 border-l border-slate-200 pl-6">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">最后对账</span>
                    <span className="text-sm font-black text-slate-700">{formatDateTime(statementDetail.generatedAt)}</span>
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
                 className="h-14 rounded-2xl bg-white/60 font-black text-slate-900 shadow-sm border border-white hover:bg-white transition-all active:scale-95 px-8"
               >
                 <RefreshCw className={cn("mr-2 h-5 w-5", isFetching && "animate-spin")} />
                 同步
               </Button>
               <Button
                 size="lg"
                 disabled={isExporting}
                 onClick={handleExport}
                 className="h-14 rounded-2xl bg-slate-900 font-black text-white shadow-xl hover:shadow-slate-200 transition-all active:scale-95 px-10"
               >
                 <Download className="mr-2 h-5 w-5" />
                 {isExporting ? '正在打包报表...' : '导出审计对账报告'}
               </Button>
            </div>
          </div>
        </div>

        {/* Audit Control Bar */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1 max-w-2xl group">
               <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 px-1">
                  <Calendar className="h-3 w-3" />
                  对账日期范围
               </div>
               <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  <div className="flex-1 rounded-[1.5rem] bg-white/60 px-4 py-1 backdrop-blur-md border border-white shadow-sm transition-all group-hover:bg-white/80 group-hover:shadow-md">
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
                    onClick={() => setDateRange({
                      startDate: defaultStartDate,
                      endDate: defaultEndDate,
                    })}
                    className="h-14 rounded-[1.5rem] bg-white/60 shadow-sm border border-white font-black text-slate-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all active:scale-95 px-10"
                  >
                    清空
                  </Button>
               </div>
            </div>
        </div>

        {/* Metrics Matrix */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
           {[
             { label: '期初余额', value: statementDetail.openingBalance, subValue: `${formatDate(statementDetail.periodStart)} 结余`, color: 'blue', icon: Layers },
             { label: '待退应付', value: refundSummary.pendingRefundAmount, subValue: `累计退货 ${formatCurrency(refundSummary.totalReturnAmount)}`, color: 'amber', icon: AlertCircle },
             { label: '核心应收', value: summary.receivables.receivableBalance, subValue: `净销流动 ${formatCurrency(receivableOverview.netSales)}`, color: 'emerald', icon: TrendingUp },
             { label: '负债应付', value: summary.payables.payableBalance, subValue: `生成债务 ${formatCurrency(payableOverview.totalGenerated)}`, color: 'rose', icon: TrendingDown },
             { label: '审计结余', value: statementDetail.closingBalance, subValue: `审计净值 ${formatCurrency(summary.netBalance)}`, color: 'slate', icon: Wallet },
           ].map((metric, i) => (
             <div key={metric.label} className="group relative overflow-hidden rounded-[2rem] border border-white bg-white/60 p-6 backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 hover:bg-white">
                <div className="relative z-10 space-y-3">
                   <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{metric.label}</span>
                      <metric.icon className={cn("h-4 w-4", `text-${metric.color}-500/50`)} />
                   </div>
                   <div className={cn("text-2xl font-black tracking-tighter", metric.color === 'emerald' ? 'text-emerald-600' : metric.color === 'rose' ? 'text-rose-600' : 'text-slate-900')}>
                      {formatCurrency(metric.value)}
                   </div>
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{metric.subValue}</div>
                </div>
                <div className={cn("absolute -right-6 -bottom-6 h-20 w-20 rounded-full blur-[30px] opacity-10 group-hover:opacity-20 transition-opacity", `bg-${metric.color}-400`)} />
             </div>
           ))}
        </div>

        {/* Audit Stream */}
        <div className="space-y-6">
           <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-black tracking-tight text-slate-900">账务流水明细</h2>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
                 <Clock className="h-3 w-3" />
                 共查得 {transactions.length} 条记录
              </div>
           </div>

           {transactions.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-24 rounded-[2.5rem] border border-dashed border-slate-200 bg-white/20">
                <FileText className="h-12 w-12 text-slate-200 mb-4" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">审计期间暂无交易流水</p>
             </div>
           ) : (
             <div className="grid gap-3">
                {transactions.map((tx: CustomerStatementTransaction) => (
                  <div key={tx.id} className="group relative overflow-hidden rounded-2xl border border-white bg-white/60 p-5 backdrop-blur-md transition-all duration-300 hover:bg-white hover:shadow-lg">
                     <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                        <div className="flex items-center gap-4 lg:min-w-[200px]">
                           <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 group-hover:bg-slate-900 group-hover:border-slate-800 transition-colors">
                              <Layers className="h-6 w-6 text-slate-400 group-hover:text-white" />
                           </div>
                           <div className="space-y-0.5">
                              <div className="text-xs font-black text-slate-400 uppercase tracking-wider">{typeLabelMap[tx.transactionType] || tx.transactionType}</div>
                              <div className="text-sm font-bold text-slate-700">{formatDateTime(tx.transactionDate, 'date')}</div>
                           </div>
                        </div>

                        <div className="flex-1 space-y-1">
                           <div className="flex items-center gap-3">
                              <span className="text-sm font-black text-slate-900">单号: {tx.referenceNumber}</span>
                              <Badge variant="secondary" className="bg-slate-100/50 hover:bg-slate-100 text-[9px] font-black uppercase tracking-widest py-0.5">
                                 {formatTransactionStatus(tx.status)}
                              </Badge>
                           </div>
                           <p className="text-xs text-slate-500 font-medium h-4 overflow-hidden text-ellipsis">{tx.description}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-8 lg:min-w-[360px] lg:border-l lg:border-slate-100 lg:pl-10">
                           <div className="space-y-1">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">账务变动 (借/贷)</span>
                              <div className="flex items-baseline gap-2">
                                 <span className={cn("text-sm font-black", tx.debitAmount > 0 ? "text-emerald-600" : tx.creditAmount > 0 ? "text-rose-600" : "text-slate-400")}>
                                    {tx.debitAmount > 0 ? `+${formatCurrency(tx.debitAmount)}` : tx.creditAmount > 0 ? `-${formatCurrency(tx.creditAmount)}` : '￥0.00'}
                                 </span>
                              </div>
                           </div>
                           <div className="space-y-1">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">计算余</span>
                              <div className="text-sm font-black text-slate-900">{formatCurrency(tx.balance)}</div>
                           </div>
                        </div>

                        <div className="lg:min-w-[40px] flex justify-end">
                           <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-200 group-hover:text-slate-900 transition-all">
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
