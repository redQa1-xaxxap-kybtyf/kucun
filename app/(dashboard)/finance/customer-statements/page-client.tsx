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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useCustomerStatementStatistics,
  useCustomerStatements,
} from '@/lib/api/customer-statements';
import type {
  CustomerStatementListItem,
  CustomerStatementQuery,
  CustomerStatementSummary,
} from '@/lib/types/customer-statement';
import { formatCurrency } from '@/lib/utils';
import { formatDate } from '@/lib/utils/datetime';

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
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="text-lg">对账单列表</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-gray-500">
                <div className="mb-2">加载中...</div>
              </div>
            ) : error ? (
              <div className="py-12 text-center text-red-600">
                <div className="mb-2">加载失败</div>
                <div className="text-sm text-gray-500">{error.message}</div>
              </div>
            ) : statements.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <div className="mb-2 text-lg">暂无数据</div>
                <div className="text-sm">暂无客户对账记录</div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">
                          客户名称
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700">
                          联系电话
                        </TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">
                          应收余额
                        </TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">
                          应付余额
                        </TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">
                          净余额
                        </TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex cursor-help items-center gap-1 border-b border-dashed border-gray-400">
                                  小汇总(净销/净收/应收)
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-sm border-blue-200 bg-blue-50 text-blue-900"
                              >
                                <div className="space-y-1 text-xs leading-relaxed">
                                  <div className="font-semibold">
                                    计算说明：
                                  </div>
                                  <div>• 净销 = 销售金额 − 退货金额</div>
                                  <div>• 净收 = 收款金额 + 预收款 − 已退款</div>
                                  <div>• 应收余额 = 净销 − 净收</div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">
                          应退金额
                        </TableHead>
                        <TableHead className="text-center font-semibold text-gray-700">
                          交易笔数
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700">
                          最后交易
                        </TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">
                          操作
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statements.map(
                        (statement: CustomerStatementListItem) => {
                          const refundMetrics = getRefundMetrics(
                            statement.summary
                          );
                          const receivableOverview = getReceivableOverview(
                            statement.summary
                          );
                          const netBalance = statement.summary.netBalance;

                          return (
                            <TableRow
                              key={statement.customerId}
                              className="group hover:bg-blue-50/50"
                            >
                              <TableCell className="font-medium text-gray-900">
                                {statement.customerName}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {statement.customerPhone || (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="font-semibold text-orange-600">
                                  {formatCurrency(
                                    statement.summary.receivables
                                      .receivableBalance
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="font-semibold text-blue-600">
                                  {formatCurrency(
                                    statement.summary.payables.payableBalance
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div
                                  className={`font-bold ${
                                    netBalance > 0
                                      ? 'text-green-600'
                                      : netBalance < 0
                                        ? 'text-red-600'
                                        : 'text-gray-600'
                                  }`}
                                >
                                  {formatBalance(netBalance)}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex flex-col items-end gap-0.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-gray-500">净销</span>
                                    <span className="font-semibold text-gray-900">
                                      {formatCurrency(
                                        receivableOverview.netSales
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-gray-500">净收</span>
                                    <span className="font-semibold text-gray-900">
                                      {formatCurrency(
                                        receivableOverview.netReceipts
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3 border-t border-gray-300 pt-0.5">
                                    <span className="text-gray-500">应收</span>
                                    <span className="font-bold text-orange-600">
                                      {formatCurrency(
                                        receivableOverview.receivableBalance
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {refundMetrics.pendingRefundAmount > 0 ? (
                                  <div className="font-semibold text-red-600">
                                    {formatCurrency(
                                      refundMetrics.pendingRefundAmount
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">¥0.00</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant="secondary"
                                  className="bg-blue-100 text-blue-700 hover:bg-blue-200"
                                >
                                  {statement.transactionCount}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {statement.lastTransactionDate ? (
                                  formatDate(statement.lastTransactionDate)
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="hover:bg-blue-100 hover:text-blue-700"
                                  asChild
                                >
                                  <Link
                                    href={`/finance/customer-statements/${statement.customerId}`}
                                    className="inline-flex items-center"
                                  >
                                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                                    查看详情
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        }
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* 分页 */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
                    <div className="text-sm text-gray-600">
                      共{' '}
                      <span className="font-semibold text-gray-900">
                        {pagination.total}
                      </span>{' '}
                      条记录， 第{' '}
                      <span className="font-semibold text-gray-900">
                        {pagination.page}
                      </span>{' '}
                      /{' '}
                      <span className="font-semibold text-gray-900">
                        {pagination.totalPages}
                      </span>{' '}
                      页
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page === 1}
                        onClick={() => handlePageChange(pagination.page - 1)}
                        className="disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        上一页
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page === pagination.totalPages}
                        onClick={() => handlePageChange(pagination.page + 1)}
                        className="disabled:cursor-not-allowed disabled:opacity-50"
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
