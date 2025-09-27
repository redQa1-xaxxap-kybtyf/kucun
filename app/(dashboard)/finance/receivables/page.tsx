'use client';

import {
  AlertCircle,
  Calendar,
  DollarSign,
  Download,
  Filter,
  Plus,
  Search,
  TrendingUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

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
import { paginationConfig } from '@/lib/env';

/**
 * 应收货款管理页面
 * 管理销售订单产生的应收账款
 */
export default function ReceivablesPage() {
  const router = useRouter();
  const [queryParams, setQueryParams] = React.useState({
    page: 1,
    limit: paginationConfig.defaultPageSize,
    search: '',
    status: undefined as string | undefined,
    sortBy: 'orderDate',
    sortOrder: 'desc' as 'asc' | 'desc',
  });

  // 模拟数据 - 实际项目中应该从API获取
  const mockData = {
    data: [
      {
        id: '1',
        orderNumber: 'SO-2025-001',
        customerName: '张三建材',
        totalAmount: 25000.0,
        paidAmount: 10000.0,
        remainingAmount: 15000.0,
        paymentStatus: 'partial',
        orderDate: '2025-01-10',
        dueDate: '2025-02-10',
        overdueDays: 0,
      },
      {
        id: '2',
        orderNumber: 'SO-2025-002',
        customerName: '李四装饰',
        totalAmount: 18000.0,
        paidAmount: 0.0,
        remainingAmount: 18000.0,
        paymentStatus: 'overdue',
        orderDate: '2024-12-15',
        dueDate: '2025-01-15',
        overdueDays: 7,
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    },
    summary: {
      totalReceivable: 125000.0,
      totalOverdue: 15000.0,
      receivableCount: 23,
      overdueCount: 3,
    },
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      unpaid: { label: '未收款', variant: 'destructive' as const },
      partial: { label: '部分收款', variant: 'secondary' as const },
      paid: { label: '已收款', variant: 'default' as const },
      overdue: { label: '逾期', variant: 'destructive' as const },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge variant={config?.variant || 'secondary'}>{config?.label}</Badge>
    );
  };

  const handleSearch = (value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  };

  const handleStatusFilter = (value: string) => {
    setQueryParams(prev => ({
      ...prev,
      status: value === 'all' ? undefined : value,
      page: 1,
    }));
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">应收货款</h1>
          <p className="text-muted-foreground">管理销售订单产生的应收账款</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
          <Button onClick={() => router.push('/sales-orders/create')}>
            <Plus className="mr-2 h-4 w-4" />
            新建销售订单
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总应收金额</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(mockData.summary.totalReceivable)}
            </div>
            <p className="text-xs text-muted-foreground">
              {mockData.summary.receivableCount} 个应收订单
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">逾期金额</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(mockData.summary.totalOverdue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {mockData.summary.overdueCount} 个逾期订单
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">收款率</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">78.5%</div>
            <p className="text-xs text-muted-foreground">较上月提升 5%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均账期</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">25天</div>
            <p className="text-xs text-muted-foreground">较上月减少 3天</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardHeader>
          <CardTitle>应收账款列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索订单号或客户名称..."
                  value={queryParams.search}
                  onChange={e => handleSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={queryParams.status || 'all'}
                onValueChange={handleStatusFilter}
              >
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="unpaid">未收款</SelectItem>
                  <SelectItem value="partial">部分收款</SelectItem>
                  <SelectItem value="paid">已收款</SelectItem>
                  <SelectItem value="overdue">逾期</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 应收账款列表 */}
          <div className="mt-6 space-y-4">
            {mockData.data.map(receivable => (
              <Card
                key={receivable.id}
                className="transition-shadow hover:shadow-md"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">
                          {receivable.orderNumber}
                        </h3>
                        {getStatusBadge(receivable.paymentStatus)}
                        {receivable.overdueDays > 0 && (
                          <Badge variant="destructive">
                            逾期 {receivable.overdueDays} 天
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        客户：{receivable.customerName}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>订单日期：{receivable.orderDate}</span>
                        {receivable.dueDate && (
                          <span>到期日期：{receivable.dueDate}</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          订单金额
                        </p>
                        <p className="font-semibold">
                          {formatCurrency(receivable.totalAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          已收金额
                        </p>
                        <p className="font-semibold text-green-600">
                          {formatCurrency(receivable.paidAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          待收金额
                        </p>
                        <p className="font-semibold text-orange-600">
                          {formatCurrency(receivable.remainingAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(`/sales-orders/${receivable.id}`)
                      }
                    >
                      查看详情
                    </Button>
                    {receivable.remainingAmount > 0 && (
                      <Button
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/payments/create?orderId=${receivable.id}`
                          )
                        }
                      >
                        收款
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 分页 */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              共 {mockData.pagination.total} 条记录
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                上一页
              </Button>
              <Button variant="outline" size="sm" disabled>
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
