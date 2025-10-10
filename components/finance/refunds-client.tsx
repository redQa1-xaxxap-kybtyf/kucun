'use client';

import { useRouter } from 'next/navigation';
import {
  Calendar,
  CheckCircle,
  DollarSign,
  Filter,
  Search,
  TrendingDown,
} from 'lucide-react';

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
import type {
  RefundMethod,
  RefundStatus,
  RefundType,
} from '@/lib/types/refund';

/**
 * 服务器组件传递的退款记录类型（日期字段已序列化为 ISO 字符串）
 */
type RefundRecordFromServer = {
  id: string;
  refundNumber: string;
  returnOrderId: string | null;
  salesOrderId: string;
  customerId: string;
  userId: string;
  refundType: RefundType;
  refundMethod: RefundMethod;
  refundAmount: number;
  processedAmount: number;
  remainingAmount: number;
  refundDate: string;
  processedDate: string | null;
  status: RefundStatus;
  reason: string;
  remarks: string | null;
  bankInfo: string | null;
  receiptNumber: string | null;
  returnOrderNumber: string | null;
  createdAt: string;
  updatedAt: string;
};

interface RefundsClientProps {
  initialData: {
    refunds: RefundRecordFromServer[];
    statistics: {
      totalRefundable: number;
      totalProcessed: number;
      totalRemaining: number;
      pendingCount: number;
      processingCount: number;
      completedCount: number;
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
    status?: RefundStatus;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onPageChange?: (page: number) => void;
}

/**
 * 退款客户端交互组件
 * 处理搜索、筛选、分页等客户端交互
 */
export function RefundsClient({
  initialData,
  initialParams,
  onSearch,
  onFilter,
  onPageChange,
}: RefundsClientProps) {
  const router = useRouter();
  const { refunds, statistics, pagination } = initialData;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount);

  const getStatusBadge = (status: RefundStatus) => {
    const statusConfig = {
      pending: { label: '待处理', variant: 'warning' as const },
      processing: { label: '处理中', variant: 'info' as const },
      completed: { label: '已完成', variant: 'success' as const },
      rejected: { label: '已拒绝', variant: 'destructive' as const },
      cancelled: { label: '已取消', variant: 'secondary' as const },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge
        variant={config?.variant || 'secondary'}
        className="text-xs font-medium"
      >
        {config?.label || '未知状态'}
      </Badge>
    );
  };

  const getTypeLabel = (type: RefundType) => {
    const typeConfig: Record<RefundType, string> = {
      full_refund: '全额退款',
      partial_refund: '部分退款',
      exchange_refund: '换货退款',
    };
    return typeConfig[type] || '其他类型';
  };

  const formatDate = (value?: string | null) => {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-[var(--shadow-medium)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总应退金额</CardTitle>
            <TrendingDown className="h-4 w-4 text-[hsl(var(--color-warning))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-warning))]">
              {formatCurrency(statistics.totalRefundable)}
            </div>
            <p className="text-muted-foreground text-xs">
              {statistics.pendingCount} 个待处理
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-medium)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已处理金额</CardTitle>
            <CheckCircle className="h-4 w-4 text-[hsl(var(--color-success))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
              {formatCurrency(statistics.totalProcessed)}
            </div>
            <p className="text-muted-foreground text-xs">
              {statistics.completedCount} 个已完成
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-medium)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">处理率</CardTitle>
            <DollarSign className="h-4 w-4 text-[hsl(var(--color-info))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-info))]">
              {statistics.totalRefundable > 0
                ? (
                    (statistics.totalProcessed / statistics.totalRefundable) *
                    100
                  ).toFixed(1)
                : '0.0'}
              %
            </div>
            <p className="text-muted-foreground text-xs">
              {statistics.processingCount} 个处理中
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-medium)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待处理金额</CardTitle>
            <Calendar className="h-4 w-4 text-[hsl(var(--color-primary))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-primary))]">
              {formatCurrency(statistics.totalRemaining)}
            </div>
            <p className="text-muted-foreground text-xs">需要处理的退款</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card className="border border-[hsl(var(--color-border-secondary))] shadow-[var(--shadow-light)]">
        <CardContent className="bg-[hsl(var(--color-bg-card))] pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="搜索退款单号、退货单号..."
                  defaultValue={initialParams?.search}
                  onChange={e => onSearch?.(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={initialParams?.status || 'all'}
                onValueChange={value =>
                  onFilter?.('status', value === 'all' ? undefined : value)
                }
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
            {refunds.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">暂无退款记录</p>
              </div>
            ) : (
              refunds.map(refund => (
                <Card
                  key={refund.id}
                  className="border border-[hsl(var(--color-border-secondary))] shadow-[var(--shadow-light)] transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">
                            {refund.refundNumber}
                          </h3>
                          {getStatusBadge(refund.status)}
                          <Badge
                            variant="outline"
                            className="text-xs font-medium"
                          >
                            {getTypeLabel(refund.refundType)}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          客户ID：{refund.customerId}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          原订单ID：{refund.salesOrderId}
                        </p>
                        <div className="text-muted-foreground flex items-center gap-4 text-sm">
                          <span>
                            退款日期：
                            {formatDate(refund.refundDate)}
                          </span>
                          <span>退款原因：{refund.reason}</span>
                        </div>
                      </div>
                      <div className="space-y-2 text-right">
                        <div>
                          <p className="text-muted-foreground text-sm">
                            退款金额
                          </p>
                          <p className="font-semibold">
                            {formatCurrency(refund.refundAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">
                            已处理
                          </p>
                          <p className="font-semibold text-[hsl(var(--color-success))]">
                            {formatCurrency(refund.processedAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">
                            待处理
                          </p>
                          <p className="font-semibold text-[hsl(var(--color-warning))]">
                            {formatCurrency(refund.remainingAmount)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!refund.returnOrderId}
                        onClick={() => {
                          if (refund.returnOrderId) {
                            router.push(
                              `/return-orders/${refund.returnOrderId}`
                            );
                          }
                        }}
                        title={
                          refund.returnOrderId
                            ? undefined
                            : '该退款未关联退货订单'
                        }
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
              ))
            )}
          </div>

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                共 {pagination.total} 条记录
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => onPageChange?.(pagination.page - 1)}
                >
                  上一页
                </Button>
                <span className="text-muted-foreground text-sm">
                  第 {pagination.page} / {pagination.totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => onPageChange?.(pagination.page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
