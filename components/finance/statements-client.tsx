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
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils/format';

interface AccountStatement {
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
  lastTransactionDate: string | null;
}

interface StatementsClientProps {
  initialData: {
    statements: AccountStatement[];
    statistics: {
      totalReceivable: number;
      totalPayable: number;
      totalCustomers: number;
      totalSuppliers: number;
    };
    pagination: {
      page: number;
      limit: number;
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
  onSearch,
  onFilter,
  onPageChange,
}: StatementsClientProps) {
  const { statements, statistics, pagination } = initialData;

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
              {formatCurrency(statistics.totalReceivable)}
            </div>
            <p className="text-muted-foreground text-xs">
              {statistics.totalCustomers} 个客户
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
              {formatCurrency(statistics.totalPayable)}
            </div>
            <p className="text-muted-foreground text-xs">
              {statistics.totalSuppliers} 个供应商
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
              {statistics.totalCustomers}
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
              {statistics.totalSuppliers}
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
                searchValue={initialParams?.search ?? ''}
                onSearchChange={value => {
                  if (onSearch) onSearch(value);
                }}
                searchPlaceholder="搜索客户或供应商名称..."
                className="max-w-sm"
              />

              <Select
                value={initialParams?.type || 'customer'}
                onValueChange={value => onFilter?.('type', value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">客户</SelectItem>
                  <SelectItem value="supplier">供应商</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={initialParams?.sortBy || 'totalAmount'}
                onValueChange={value => onFilter?.('sortBy', value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="totalAmount">总金额</SelectItem>
                  <SelectItem value="pendingAmount">待付金额</SelectItem>
                  <SelectItem value="overdueAmount">逾期金额</SelectItem>
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
                // 调试：检查statement.id是否存在
                if (!statement.id) {
                  logger.error(
                    'finance-statements',
                    'Statement missing id',
                    undefined,
                    undefined,
                    { statement }
                  );
                }

                return (
                  <Card
                    key={statement.id}
                    className="transition-shadow hover:shadow-[var(--shadow-medium)]"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold">
                              {statement.name}
                            </h3>
                            <Badge variant="outline">
                              {statement.type === 'customer'
                                ? '客户'
                                : '供应商'}
                            </Badge>
                            {statement.overdueAmount > 0 && (
                              <Badge variant="destructive">逾期</Badge>
                            )}
                          </div>

                          <div className="text-muted-foreground grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">订单数量：</span>
                              {statement.totalOrders}
                            </div>
                            <div>
                              <span className="font-medium">信用额度：</span>
                              {formatCurrency(statement.creditLimit)}
                            </div>
                            <div>
                              <span className="font-medium">付款条款：</span>
                              {statement.paymentTerms}
                            </div>
                            {statement.lastTransactionDate && (
                              <div>
                                <span className="font-medium">最后交易：</span>
                                {format(
                                  new Date(statement.lastTransactionDate),
                                  'yyyy-MM-dd'
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="ml-6 space-y-2 text-right">
                          <div>
                            <p className="text-muted-foreground text-sm">
                              总金额
                            </p>
                            <p className="text-xl font-bold">
                              {formatCurrency(statement.totalAmount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-sm">
                              已付
                            </p>
                            <p className="text-sm font-semibold text-[hsl(var(--color-success))]">
                              {formatCurrency(statement.paidAmount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-sm">
                              待付
                            </p>
                            <p className="text-sm font-semibold text-[hsl(var(--color-warning))]">
                              {formatCurrency(statement.pendingAmount)}
                            </p>
                          </div>
                          {statement.overdueAmount > 0 && (
                            <div>
                              <p className="text-muted-foreground text-sm">
                                逾期
                              </p>
                              <p className="text-sm font-semibold text-[hsl(var(--color-error))]">
                                {formatCurrency(statement.overdueAmount)}
                              </p>
                            </div>
                          )}
                          <div className="mt-4 flex gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link
                                href={`/finance/statements/${statement.id}`}
                              >
                                查看详情
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
