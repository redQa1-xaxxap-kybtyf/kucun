'use client';

import {
  Calendar,
  CheckCircle,
  DollarSign,
  Download,
  Filter,
  Plus,
  Search,
  TrendingDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { paginationConfig } from '@/lib/env';

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

/**
 * 应退货款管理页面
 * 管理退货订单产生的应退账款
 */
export default function RefundsPage() {
  const router = useRouter();
  const [queryParams, setQueryParams] = React.useState({
    page: 1,
    limit: paginationConfig.defaultPageSize,
    search: '',
    status: undefined as string | undefined,
    sortBy: 'returnDate',
    sortOrder: 'desc' as 'asc' | 'desc',
  });

  // 模拟数据 - 实际项目中应该从API获取
  const mockData = {
    data: [
      {
        id: '1',
        returnNumber: 'RT-2025-001',
        salesOrderNumber: 'SO-2025-001',
        customerName: '张三建材',
        refundAmount: 5000.0,
        processedAmount: 0.0,
        remainingAmount: 5000.0,
        status: 'pending',
        returnDate: '2025-01-15',
        reason: '产品质量问题',
        type: 'refund',
      },
      {
        id: '2',
        returnNumber: 'RT-2025-002',
        salesOrderNumber: 'SO-2024-089',
        customerName: '李四装饰',
        refundAmount: 3500.0,
        processedAmount: 3500.0,
        remainingAmount: 0.0,
        status: 'completed',
        returnDate: '2025-01-12',
        reason: '规格不符',
        type: 'refund',
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    },
    summary: {
      totalRefundable: 8500.0,
      totalProcessed: 3500.0,
      pendingCount: 5,
      completedCount: 12,
    },
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: '待处理', variant: 'secondary' as const },
      processing: { label: '处理中', variant: 'default' as const },
      completed: { label: '已完成', variant: 'default' as const },
      rejected: { label: '已拒绝', variant: 'destructive' as const },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge variant={config?.variant || 'secondary'}>{config?.label}</Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    const typeConfig = {
      refund: '退款',
      exchange: '换货',
      return: '退货',
    };
    return typeConfig[type as keyof typeof typeConfig] || type;
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
          <h1 className="text-3xl font-bold tracking-tight">应退货款</h1>
          <p className="text-muted-foreground">管理退货订单产生的应退账款</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
          <Button onClick={() => router.push('/return-orders/create')}>
            <Plus className="mr-2 h-4 w-4" />
            新建退货订单
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总应退金额</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(mockData.summary.totalRefundable)}
            </div>
            <p className="text-xs text-muted-foreground">
              {mockData.summary.pendingCount} 个待处理
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已处理金额</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(mockData.summary.totalProcessed)}
            </div>
            <p className="text-xs text-muted-foreground">
              {mockData.summary.completedCount} 个已完成
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">处理率</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">70.6%</div>
            <p className="text-xs text-muted-foreground">较上月提升 8%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均处理时间</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">3天</div>
            <p className="text-xs text-muted-foreground">较上月减少 1天</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardHeader>
          <CardTitle>退款申请列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索退货单号或客户名称..."
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
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="processing">处理中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="rejected">已拒绝</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 退款申请列表 */}
          <div className="mt-6 space-y-4">
            {mockData.data.map(refund => (
              <Card
                key={refund.id}
                className="transition-shadow hover:shadow-md"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{refund.returnNumber}</h3>
                        {getStatusBadge(refund.status)}
                        <Badge variant="outline">
                          {getTypeLabel(refund.type)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        客户：{refund.customerName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        原订单：{refund.salesOrderNumber}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>退货日期：{refund.returnDate}</span>
                        <span>退货原因：{refund.reason}</span>
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          退款金额
                        </p>
                        <p className="font-semibold">
                          {formatCurrency(refund.refundAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">已处理</p>
                        <p className="font-semibold text-green-600">
                          {formatCurrency(refund.processedAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">待处理</p>
                        <p className="font-semibold text-orange-600">
                          {formatCurrency(refund.remainingAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/return-orders/${refund.id}`)}
                    >
                      查看详情
                    </Button>
                    {refund.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() =>
                          router.push(`/finance/refunds/${refund.id}/process`)
                        }
                      >
                        处理退款
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
