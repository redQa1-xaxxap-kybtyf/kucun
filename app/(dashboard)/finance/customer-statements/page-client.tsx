'use client';

// 客户对账单页面 - 客户端组件

import { Download, FileText } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useCustomerStatementStatistics,
  useCustomerStatements,
} from '@/lib/api/customer-statements';
import type {
  CustomerStatementListItem,
  CustomerStatementQuery,
  CustomerStatementSummary,
} from '@/lib/types/customer-statement';
import { formatCurrency, formatDate } from '@/lib/utils';

interface CustomerStatementsPageClientProps {
  initialData?: {
    statements: CustomerStatementListItem[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
  initialParams?: CustomerStatementQuery;
}

export function CustomerStatementsPageClient({
  initialData,
  initialParams = {},
}: CustomerStatementsPageClientProps) {
  // 查询参数状态
  const [queryParams, setQueryParams] =
    useState<CustomerStatementQuery>(initialParams);

  // 使用TanStack Query获取数据
  const { data, isLoading, error } = useCustomerStatements(queryParams, {
    enabled: true,
  });

  const statementSource =
    data ??
    (initialData
      ? {
          statements: initialData.statements,
          pagination: initialData.pagination,
        }
      : undefined);

  const statements = statementSource?.statements ?? [];
  const pagination = statementSource?.pagination;

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
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">客户对账单</h1>
            <p className="text-muted-foreground mt-2">
              管理与客户之间的完整财务往来记录
            </p>
          </div>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            批量导出
          </Button>
        </div>

        {/* 筛选栏 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="搜索客户名称..."
                  value={queryParams.customerName || ''}
                  onChange={e => handleSearch(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <Select
                value={queryParams.balanceType || 'all'}
                onValueChange={value =>
                  handleBalanceTypeChange(
                    value as 'receivable' | 'payable' | 'all'
                  )
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="余额类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="receivable">应收余额</SelectItem>
                  <SelectItem value="payable">应付余额</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总应收余额</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
                {statisticsLoading
                  ? '加载中...'
                  : formatCurrency(totalReceivableBalance)}
              </div>
              {statisticsError && (
                <p className="text-muted-foreground mt-2 text-xs">
                  汇总数据暂不可用，已fallback至当前页数据。
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总应付余额</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--color-error))]">
                {statisticsLoading
                  ? '加载中...'
                  : formatCurrency(totalPayableBalance)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总应退金额</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--color-warning))]">
                {statisticsLoading
                  ? '加载中...'
                  : formatCurrency(totalPendingRefundBalance)}
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                退货合计：{formatCurrency(totalReturnAmount)}，已退款：
                {formatCurrency(totalRefundPaidAmount)}
              </p>
              {!statisticsData && (
                <p className="text-muted-foreground mt-1 text-xs">
                  统计服务暂未提供此指标，基于当前列表数据估算。
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">净余额</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statisticsLoading
                  ? '加载中...'
                  : formatCurrency(totalNetBalance)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 对账单列表 */}
        <Card>
          <CardHeader>
            <CardTitle>对账单列表</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center">加载中...</div>
            ) : error ? (
              <div className="py-8 text-center text-[hsl(var(--color-error))]">
                加载失败: {error.message}
              </div>
            ) : statements.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                暂无数据
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>客户名称</TableHead>
                      <TableHead>联系电话</TableHead>
                      <TableHead className="text-right">应收余额</TableHead>
                      <TableHead className="text-right">应付余额</TableHead>
                      <TableHead className="text-right">净余额</TableHead>
                      <TableHead className="text-right">应退金额</TableHead>
                      <TableHead>交易笔数</TableHead>
                      <TableHead>最后交易</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statements.map((statement: CustomerStatementListItem) => {
                      const refundMetrics = getRefundMetrics(statement.summary);
                      return (
                        <TableRow key={statement.customerId}>
                          <TableCell className="font-medium">
                            {statement.customerName}
                          </TableCell>
                          <TableCell>
                            {statement.customerPhone || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(
                              statement.summary.receivables.receivableBalance
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(
                              statement.summary.payables.payableBalance
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatBalance(statement.summary.netBalance)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(refundMetrics.pendingRefundAmount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {statement.transactionCount}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {statement.lastTransactionDate
                              ? formatDate(statement.lastTransactionDate)
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link
                                href={`/finance/customer-statements/${statement.customerId}`}
                                className="inline-flex items-center"
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                查看详情
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* 分页 */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-muted-foreground text-sm">
                      共 {pagination.total} 条记录，第 {pagination.page} /{' '}
                      {pagination.totalPages} 页
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page === 1}
                        onClick={() => handlePageChange(pagination.page - 1)}
                      >
                        上一页
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page === pagination.totalPages}
                        onClick={() => handlePageChange(pagination.page + 1)}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
