'use client';

import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Users, FileText } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils/format';

type StatementBadgeType = 'customer' | 'supplier' | 'partner';

interface AccountStatementItem {
  id: string;
  name: string;
  type: StatementBadgeType;
  partnerRole: 'customer' | 'supplier' | 'both';
  status: 'active' | 'settled' | 'suspended';
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  currentBalance: number;
  lastTransactionDate: string | null;
  lastPaymentDate: string | null;
}

const TYPE_LABEL_MAP: Record<StatementBadgeType, string> = {
  customer: '客户',
  supplier: '供应商',
  partner: '往来伙伴',
};

const STATUS_LABEL_MAP: Record<AccountStatementItem['status'], string> = {
  active: '进行中',
  settled: '已结清',
  suspended: '已暂停',
};

interface StatementsClientProps {
  initialData: {
    statements: AccountStatementItem[];
    summary: {
      totalReceivable: number;
      totalPayable: number;
      totalCustomers: number;
      totalSuppliers: number;
    };
    pagination: {
      page: number;
      limit: number;
      pageSize?: number;
      total: number;
      totalPages: number;
    };
  };
  initialParams?: {
    page: number;
    limit: number;
    search?: string;
    type?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  filters?: {
    search?: string;
    type?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onPageChange?: (page: number) => void;
}

/**
 * 往来账单客户端组件
 */
export function StatementsClient({
  initialData,
  initialParams,
  filters,
  onSearch,
  onFilter,
  onPageChange,
}: StatementsClientProps) {
  const { statements, summary, pagination } = initialData;
  const effectiveFilters = {
    search: filters?.search ?? initialParams?.search ?? '',
    type: filters?.type ?? initialParams?.type ?? 'all',
    sortBy: filters?.sortBy ?? initialParams?.sortBy ?? 'totalAmount',
    sortOrder: filters?.sortOrder ?? initialParams?.sortOrder ?? 'desc',
  };

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">应收账款</CardTitle>
            <TrendingUp className="h-4 w-4 text-[hsl(var(--color-success))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
              {formatCurrency(summary.totalReceivable)}
            </div>
            <p className="text-muted-foreground text-xs">
              {summary.totalCustomers} 个客户
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">应付账款</CardTitle>
            <TrendingDown className="h-4 w-4 text-[hsl(var(--color-warning))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-warning))]">
              {formatCurrency(summary.totalPayable)}
            </div>
            <p className="text-muted-foreground text-xs">
              {summary.totalSuppliers} 个供应商
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">客户数量</CardTitle>
            <Users className="h-4 w-4 text-[hsl(var(--color-primary))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-primary))]">
              {summary.totalCustomers}
            </div>
            <p className="text-muted-foreground text-xs">活跃客户</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">供应商数量</CardTitle>
            <FileText className="h-4 w-4 text-[hsl(var(--color-purple))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-purple))]">
              {summary.totalSuppliers}
            </div>
            <p className="text-muted-foreground text-xs">活跃供应商</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <UnifiedSearchBar
                searchValue={effectiveFilters.search ?? ''}
                onSearchChange={value => {
                  if (onSearch) {
                    onSearch(value);
                  }
                }}
                searchPlaceholder="搜索伙伴名称..."
                className="max-w-sm"
              />

              <Select
                value={effectiveFilters.type || 'all'}
                onValueChange={value =>
                  onFilter?.('type', value === 'all' ? undefined : value)
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="customer">客户</SelectItem>
                  <SelectItem value="supplier">供应商</SelectItem>
                  <SelectItem value="partner">往来伙伴</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={effectiveFilters.sortBy || 'totalAmount'}
                onValueChange={value => onFilter?.('sortBy', value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="totalAmount">总金额</SelectItem>
                  <SelectItem value="pendingAmount">余额</SelectItem>
                  <SelectItem value="totalOrders">订单数量</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 往来账单列表 */}
          <div className="mt-6 space-y-4">
            {statements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="text-muted-foreground mb-4 h-12 w-12" />
                <p className="text-muted-foreground">暂无往来账单</p>
              </div>
            ) : (
              statements.map(statement => {
                const balance = statement.currentBalance ?? 0;
                const balanceLabel =
                  balance > 0 ? '应收余额' : balance < 0 ? '应付余额' : '余额';
                const balanceColorClass =
                  balance > 0
                    ? 'text-[hsl(var(--color-success))]'
                    : balance < 0
                      ? 'text-[hsl(var(--color-warning))]'
                      : 'text-muted-foreground';
                const statusVariant =
                  statement.status === 'settled'
                    ? 'secondary'
                    : statement.status === 'suspended'
                      ? 'destructive'
                      : 'outline';

                // 计算付款率和待收付百分比
                const paymentRate =
                  Math.abs(statement.totalAmount) > 0
                    ? (Math.abs(statement.paidAmount) /
                        Math.abs(statement.totalAmount)) *
                      100
                    : 0;
                const pendingRate = Math.max(100 - paymentRate, 0);

                return (
                  <Card
                    key={statement.id}
                    className="overflow-hidden transition-all hover:border-[hsl(var(--color-primary))] hover:shadow-[var(--shadow-medium)]"
                  >
                    <CardContent className="p-0">
                      <div className="flex flex-col lg:flex-row">
                        {/* 左侧：主要信息 */}
                        <div className="flex-1 space-y-4 p-6">
                          {/* 标题区域 */}
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-bold text-[hsl(var(--color-text-primary))]">
                              {statement.name}
                            </h3>
                            <Badge variant="outline" className="font-medium">
                              {TYPE_LABEL_MAP[statement.type]}
                            </Badge>
                            <Badge
                              variant={statusVariant}
                              className="font-medium"
                            >
                              {STATUS_LABEL_MAP[statement.status]}
                            </Badge>
                          </div>

                          {/* 统计指标网格 */}
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-1">
                              <p className="text-muted-foreground text-xs">
                                订单数量
                              </p>
                              <p className="text-2xl font-bold text-[hsl(var(--color-info))]">
                                {statement.totalOrders}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground text-xs">
                                总交易额
                              </p>
                              <p className="text-2xl font-bold">
                                {formatCurrency(
                                  Math.abs(statement.totalAmount)
                                )}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground text-xs">
                                已收付金额
                              </p>
                              <p className="text-2xl font-bold text-[hsl(var(--color-success))]">
                                {formatCurrency(Math.abs(statement.paidAmount))}
                              </p>
                            </div>
                          </div>

                          {/* 付款进度条 */}
                          {statement.totalAmount > 0 && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  付款进度
                                </span>
                                <span className="font-medium">
                                  {paymentRate.toFixed(1)}%
                                </span>
                              </div>
                              <div className="bg-muted h-2 overflow-hidden rounded-full">
                                <div
                                  className="h-full bg-gradient-to-r from-[hsl(var(--color-success))] to-[hsl(var(--color-info))] transition-all"
                                  style={{ width: `${paymentRate}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* 时间信息 */}
                          <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
                            {statement.lastTransactionDate && (
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">最后交易:</span>
                                <span>
                                  {format(
                                    new Date(statement.lastTransactionDate),
                                    'yyyy-MM-dd HH:mm'
                                  )}
                                </span>
                              </div>
                            )}
                            {statement.lastPaymentDate && (
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">最近收付:</span>
                                <span>
                                  {format(
                                    new Date(statement.lastPaymentDate),
                                    'yyyy-MM-dd HH:mm'
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 右侧：余额和操作 */}
                        <div className="bg-muted/30 flex flex-col justify-between space-y-4 p-6 lg:w-64">
                          <div className="space-y-4">
                            {/* 当前余额 */}
                            <div className="space-y-2 text-center">
                              <p className="text-muted-foreground text-sm">
                                {balanceLabel}
                              </p>
                              <p
                                className={`text-3xl font-bold ${balanceColorClass}`}
                              >
                                {formatCurrency(Math.abs(balance))}
                              </p>
                            </div>

                            {/* 待收付金额 */}
                            {statement.pendingAmount > 0 && (
                              <div className="border-border/50 border-t pt-4">
                                <div className="space-y-1 text-center">
                                  <p className="text-muted-foreground text-xs">
                                    待收付金额
                                  </p>
                                  <p className="text-lg font-semibold text-[hsl(var(--color-warning))]">
                                    {formatCurrency(statement.pendingAmount)}
                                  </p>
                                  <p className="text-muted-foreground text-xs">
                                    占比 {pendingRate.toFixed(1)}%
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              className="w-full"
                              asChild
                            >
                              <Link
                                href={`/finance/statements/${statement.id}`}
                              >
                                查看详情
                              </Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              asChild
                            >
                              <Link
                                href={`/finance/statements/${statement.id}/transactions`}
                              >
                                交易记录
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={page => {
                  if (onPageChange) {
                    onPageChange(page);
                  }
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
