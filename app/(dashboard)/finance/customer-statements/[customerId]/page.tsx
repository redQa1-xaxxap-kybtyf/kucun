'use client';

import { ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { format, subDays } from 'date-fns';

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCustomerStatementDetail } from '@/lib/api/customer-statements';
import { CUSTOMER_STATEMENT_TRANSACTION_TYPES } from '@/lib/types/customer-statement';
import { formatCurrency, formatDate } from '@/lib/utils';

const DEFAULT_RANGE_DAYS = 30;

export default function CustomerStatementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const customerId = params.customerId as string | undefined;

  const today = new Date();
  const defaultEndDate = format(today, 'yyyy-MM-dd');
  const defaultStartDate = format(subDays(today, DEFAULT_RANGE_DAYS), 'yyyy-MM-dd');

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

  const typeLabelMap = useMemo(() => {
    return CUSTOMER_STATEMENT_TRANSACTION_TYPES.reduce(
      (acc, item) => {
        acc[item.type] = item.label;
        return acc;
      },
      {} as Record<string, string>
    );
  }, []);

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
            error instanceof Error
              ? error.message
              : '获取对账单详情时发生错误'
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
              对账期间：{formatDate(statementDetail.periodStart, 'date')} -{' '}
              {formatDate(statementDetail.periodEnd, 'date')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            数据生成于 {formatDate(statementDetail.generatedAt, 'datetime')}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex flex-1 flex-col gap-2 md:max-w-xs">
              <label className="text-sm font-medium text-muted-foreground">
                开始日期
              </label>
              <Input
                type="date"
                value={dateRange.startDate}
                max={dateRange.endDate}
                onChange={event =>
                  setDateRange(prev => ({
                    ...prev,
                    startDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-1 flex-col gap-2 md:max-w-xs">
              <label className="text-sm font-medium text-muted-foreground">
                结束日期
              </label>
              <Input
                type="date"
                value={dateRange.endDate}
                min={dateRange.startDate}
                max={format(today, 'yyyy-MM-dd')}
                onChange={event =>
                  setDateRange(prev => ({
                    ...prev,
                    endDate: event.target.value,
                  }))
                }
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm font-medium">期初余额</CardTitle>
            <p className="text-muted-foreground text-xs">
              {formatDate(statementDetail.periodStart, 'date')} 之前
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
            <CardTitle className="text-sm font-medium">应收余额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[hsl(var(--color-success))]">
              {formatCurrency(summary.receivables.receivableBalance)}
            </div>
            {summary.receivables.prepaymentReceived > 0 && (
              <p className="text-muted-foreground mt-1 text-xs">
                含预收款：{formatCurrency(summary.receivables.prepaymentReceived)}
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
            <div className="py-8 text-center text-muted-foreground">
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
                    <TableHead className="text-right min-w-[120px]">
                      借方金额
                    </TableHead>
                    <TableHead className="text-right min-w-[120px]">
                      贷方金额
                    </TableHead>
                    <TableHead className="text-right min-w-[140px]">
                      余额
                    </TableHead>
                    <TableHead className="min-w-[100px]">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map(transaction => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {formatDate(transaction.transactionDate, 'datetime')}
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
                          {transaction.status === 'confirmed'
                            ? '已确认'
                            : transaction.status === 'pending'
                              ? '待确认'
                              : transaction.status === 'cancelled'
                                ? '已取消'
                                : transaction.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
