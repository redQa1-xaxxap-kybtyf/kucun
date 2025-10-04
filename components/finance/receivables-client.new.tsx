'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

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
import type { ReceivableItem } from '@/lib/services/receivables-service';
import { formatCurrency, formatDate } from '@/lib/utils';

/**
 * 应收账款响应数据类型
 */
interface ReceivablesResponse {
  receivables: ReceivableItem[];
  summary: {
    totalReceivables: number;
    totalReceived: number;
    totalRemaining: number;
    overdueAmount: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ReceivablesClientProps {
  searchParams: Record<string, string>;
}

/**
 * 应收账款客户端组件
 * 使用 TanStack Query 管理数据状态
 */
export function ReceivablesClient({ searchParams }: ReceivablesClientProps) {
  const router = useRouter();
  const searchParamsObj = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(searchParams.search || '');

  // 获取应收账款数据
  const { data, isLoading, error } = useQuery<{
    data: ReceivablesResponse;
  }>({
    queryKey: ['receivables', searchParams],
    queryFn: async () => {
      const params = new URLSearchParams(searchParams);
      const response = await fetch(`/api/finance/receivables?${params}`);

      if (!response.ok) {
        throw new Error('获取应收账款失败');
      }

      return response.json();
    },
  });

  // 获取客户列表（用于筛选）
  const { data: customersData } = useQuery({
    queryKey: ['customers', 'list'],
    queryFn: async () => {
      const response = await fetch('/api/customers?pageSize=100');
      return response.json();
    },
  });

  // 处理搜索
  const handleSearch = () => {
    startTransition(() => {
      const params = new URLSearchParams(searchParamsObj);
      if (searchInput) {
        params.set('search', searchInput);
      } else {
        params.delete('search');
      }
      params.set('page', '1'); // 重置页码
      router.push(`/finance/receivables?${params.toString()}`);
    });
  };

  // 处理筛选
  const handleFilter = (key: string, value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParamsObj);
      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.set('page', '1'); // 重置页码
      router.push(`/finance/receivables?${params.toString()}`);
    });
  };

  // 处理排序
  const handleSort = (column: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParamsObj);
      const currentSort = params.get('sortBy');
      const currentOrder = params.get('sortOrder');

      if (currentSort === column) {
        params.set('sortOrder', currentOrder === 'asc' ? 'desc' : 'asc');
      } else {
        params.set('sortBy', column);
        params.set('sortOrder', 'desc');
      }

      router.push(`/finance/receivables?${params.toString()}`);
    });
  };

  // 处理分页
  const handlePageChange = (newPage: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParamsObj);
      params.set('page', String(newPage));
      router.push(`/finance/receivables?${params.toString()}`);
    });
  };

  // 获取支付状态样式
  const getPaymentStatusBadge = (status: string) => {
    const variants = {
      paid: 'success',
      unpaid: 'secondary',
      partial: 'outline',
      overdue: 'destructive',
    } as const;

    const labels = {
      paid: '已付清',
      unpaid: '未付款',
      partial: '部分付款',
      overdue: '已逾期',
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-destructive text-center">
            加载数据失败：{error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const receivables = data?.data?.receivables || [];
  const summary = data?.data?.summary || {
    totalReceivables: 0,
    totalReceived: 0,
    totalRemaining: 0,
    overdueAmount: 0,
  };
  const pagination = data?.data?.pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">总应收金额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalReceivable || 0)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              共 {summary.receivableCount || 0} 笔
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">逾期金额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-destructive text-2xl font-bold">
              {formatCurrency(summary.totalOverdue || 0)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              共 {summary.overdueCount || 0} 笔
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">未付款订单</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.unpaidCount || 0}</div>
            <p className="text-muted-foreground mt-1 text-xs">需要跟进</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">部分付款</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.partialCount || 0}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">继续收款</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选和搜索 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            {/* 搜索框 */}
            <div className="flex flex-1 gap-2">
              <Input
                placeholder="搜索订单号、客户名称..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSearch()}
                className="max-w-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleSearch}
                disabled={isPending}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {/* 筛选器 */}
            <div className="flex gap-2">
              <Select
                value={searchParams.status || 'all'}
                onValueChange={value => handleFilter('status', value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="支付状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="unpaid">未付款</SelectItem>
                  <SelectItem value="partial">部分付款</SelectItem>
                  <SelectItem value="paid">已付清</SelectItem>
                  <SelectItem value="overdue">已逾期</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={searchParams.customerId || 'all'}
                onValueChange={value => handleFilter('customerId', value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="选择客户" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部客户</SelectItem>
                  {customersData?.data?.customers?.map(
                    (customer: { id: string; name: string }) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>订单号</TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('customerName')}
                  >
                    客户
                    <ArrowUpDown className="ml-2 inline h-4 w-4" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('orderDate')}
                  >
                    订单日期
                    <ArrowUpDown className="ml-2 inline h-4 w-4" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer text-right"
                    onClick={() => handleSort('totalAmount')}
                  >
                    订单金额
                    <ArrowUpDown className="ml-2 inline h-4 w-4" />
                  </TableHead>
                  <TableHead className="text-right">已收金额</TableHead>
                  <TableHead className="text-right">应收余额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>逾期天数</TableHead>
                  <TableHead>最后收款</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : receivables.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  receivables.map((item: ReceivableItem) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.orderNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.customerName}</p>
                          {item.customerPhone && (
                            <p className="text-muted-foreground text-xs">
                              {item.customerPhone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(item.orderDate)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.paidAmount)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.remainingAmount)}
                      </TableCell>
                      <TableCell>
                        {getPaymentStatusBadge(item.paymentStatus)}
                      </TableCell>
                      <TableCell>
                        {item.overdueDays > 0 ? (
                          <span className="text-destructive font-medium">
                            {item.overdueDays} 天
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.lastPaymentDate ? (
                          formatDate(item.lastPaymentDate)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/sales-orders/${item.id}`)
                          }
                        >
                          查看详情
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 分页 */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1 || isPending}
          >
            上一页
          </Button>
          <span className="text-muted-foreground text-sm">
            第 {pagination.page} / {pagination.totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || isPending}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
