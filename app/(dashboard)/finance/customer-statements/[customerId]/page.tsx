'use client';

import { format, subDays } from 'date-fns';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { ErrorMessage } from '@/components/ui/error-message';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  customerStatementApi,
  useCustomerStatementDetail,
} from '@/lib/api/customer-statements';
import {
  CUSTOMER_STATEMENT_TRANSACTION_TYPES,
  type CustomerStatementTransaction,
} from '@/lib/types/customer-statement';
import { formatCurrency } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/utils/datetime';

const DEFAULT_RANGE_DAYS = 30;

function formatTransactionStatus(status: string): string {
  const STATUS_LABELS: Record<string, string> = {
    // 通用状态
    pending: '待确认',
    confirmed: '已确认',
    cancelled: '已取消',
    completed: '已完成',
    processing: '处理中',
    approved: '已审核',
    rejected: '已拒绝',
    draft: '草稿',

    // 订单相关
    shipped: '已发货',
    submitted: '已提交',

    // 收款/预收款相关
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
    if (!customerId) {
      return;
    }

    const currentStart = searchParams.get('startDate');
    const currentEnd = searchParams.get('endDate');

    if (
      currentStart === dateRange.startDate &&
      currentEnd === dateRange.endDate
    ) {
      return;
    }

    const params = new URLSearchParams();
    if (dateRange.startDate) {
      params.set('startDate', dateRange.startDate);
    }
    if (dateRange.endDate) {
      params.set('endDate', dateRange.endDate);
    }

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

  // ✅ 修复: 将所有 hooks 移到条件判断之前，遵循 React Hooks 规则
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

    return statementDetail.transactions.reduce<{
      totalReturnAmount: number;
      totalRefundPaid: number;
      pendingRefundAmount: number;
    }>(
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
      {
        totalReturnAmount: 0,
        totalRefundPaid: 0,
        pendingRefundAmount: 0,
      }
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

    // 已处理的退款金额（包含退货退款 + 补偿退款）
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
    if (!payables) {
      return {
        totalGenerated: 0,
        totalPaid: 0,
      };
    }

    const purchaseAmount = Number(payables.purchaseAmount ?? 0);
    const purchaseReturnAmount = Number(payables.purchaseReturnAmount ?? 0);
    const refundReceived = Number(payables.refundReceived ?? 0);
    const paymentPaid = Number(payables.paymentPaid ?? 0);
    const prepaymentPaid = Number(payables.prepaymentPaid ?? 0);

    const totalGenerated =
      purchaseAmount - purchaseReturnAmount - refundReceived;
    const totalPaid = paymentPaid + prepaymentPaid;

    return {
      totalGenerated,
      totalPaid,
    };
  }, [statementDetail?.summary?.payables]);

  // ✅ 所有 hooks 调用完毕，现在可以安全地进行条件渲染
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
      <div className="space-y-4 px-4 py-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/finance/customer-statements">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回列表
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">客户对账单详情</h1>
        </div>
        <ErrorMessage
          title="日期范围无效"
          message="开始日期不能晚于结束日期，请调整后重试。"
          variant="warning"
        />
      </div>
    );
  }

  if (isLoading) {
    return <ContentLoading text="加载对账单详情..." />;
  }

  if (error) {
    return (
      <div className="space-y-4 px-4 py-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/finance/customer-statements">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回列表
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">客户对账单详情</h1>
        </div>
        <ErrorMessage
          title="加载失败"
          message={
            error instanceof Error ? error.message : '获取对账单详情时发生错误'
          }
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!statementDetail) {
    return (
      <div className="space-y-4 px-4 py-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/finance/customer-statements">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回列表
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">客户对账单详情</h1>
        </div>
        <ErrorMessage
          title="暂无对账数据"
          message="该日期范围内没有找到对账记录。"
          variant="warning"
        />
      </div>
    );
  }

  const { summary, transactions } = statementDetail;

  const handleExport = async () => {
    try {
      await customerStatementApi.exportStatementToExcel(statementDetail);
    } catch (exportError) {
      // 简单的前端提示，避免引入全局toast依赖
      // 可以后续接入统一的通知系统
      // eslint-disable-next-line no-alert
      alert(
        exportError instanceof Error
          ? `导出失败：${exportError.message}`
          : '导出失败'
      );
    }
  };

  return (
    <div className="space-y-6 px-4 py-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/finance/customer-statements">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回列表
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">
              {statementDetail.customerName}
            </h1>
            <p className="text-muted-foreground text-sm">
              对账期间：{formatDate(statementDetail.periodStart)} -{' '}
              {formatDate(statementDetail.periodEnd)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground hidden text-xs md:inline">
            数据生成于 {formatDateTime(statementDetail.generatedAt)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleExport}
          >
            <Download className="h-4 w-4" />
            导出本期对账单
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 md:max-w-md">
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
                label="对账期间"
                maxDate={today}
                showPresets={true}
                showClearButton={false}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setDateRange({
                    startDate: defaultStartDate,
                    endDate: defaultEndDate,
                  })
                }
              >
                重置
              </Button>
              <Button
                variant="secondary"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {isFetching ? '刷新中...' : '刷新'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm font-medium">期初余额</CardTitle>
            <p className="text-muted-foreground text-xs">
              {formatDate(statementDetail.periodStart)} 之前
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[hsl(var(--color-primary))]">
              {formatCurrency(statementDetail.openingBalance)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm font-medium">应退金额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[hsl(var(--color-warning))]">
              {formatCurrency(refundSummary.pendingRefundAmount)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              退货合计：{formatCurrency(refundSummary.totalReturnAmount)}
              ，已退款：
              {formatCurrency(refundSummary.totalRefundPaid)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm font-medium">
              应收余额（客户欠我们）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[hsl(var(--color-success))]">
              {formatCurrency(summary.receivables.receivableBalance)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              销售：{formatCurrency(receivableOverview.salesAmount)}，退货：
              {formatCurrency(receivableOverview.salesReturnAmount)}，净销售：
              {formatCurrency(receivableOverview.netSales)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              收款：{formatCurrency(receivableOverview.totalReceipts)}，退款：
              {formatCurrency(receivableOverview.refundProcessed)}，净收款：
              {formatCurrency(receivableOverview.netReceipts)}
            </p>
            {summary.receivables.prepaymentReceived > 0 && (
              <p className="text-muted-foreground mt-1 text-xs">
                其中预收款：
                {formatCurrency(summary.receivables.prepaymentReceived)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm font-medium">应付余额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[hsl(var(--color-error))]">
              {formatCurrency(summary.payables.payableBalance)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              应付合计：{formatCurrency(payableOverview.totalGenerated)}，已付：
              {formatCurrency(payableOverview.totalPaid)}
            </p>
            {summary.payables.prepaymentPaid > 0 && (
              <p className="text-muted-foreground mt-1 text-xs">
                含预付款：{formatCurrency(summary.payables.prepaymentPaid)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm font-medium">期末余额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrency(statementDetail.closingBalance)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              净余额：{formatCurrency(summary.netBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>交易明细</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              该时间段内暂无交易记录。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">日期</TableHead>
                    <TableHead className="min-w-[120px]">类型</TableHead>
                    <TableHead className="min-w-[160px]">单据号</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead className="min-w-[120px] text-right">
                      增加应收金额
                    </TableHead>
                    <TableHead className="min-w-[120px] text-right">
                      减少应收金额
                    </TableHead>
                    <TableHead className="min-w-[140px] text-right">
                      余额
                    </TableHead>
                    <TableHead className="min-w-[100px]">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map(
                    (transaction: CustomerStatementTransaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {formatDateTime(transaction.transactionDate)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {typeLabelMap[transaction.transactionType] ??
                              transaction.transactionType}
                          </Badge>
                        </TableCell>
                        <TableCell>{transaction.referenceNumber}</TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(transaction.debitAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(transaction.creditAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(transaction.balance)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {formatTransactionStatus(transaction.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
