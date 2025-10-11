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
 * 服务器组件传递的退款记录类型（日期字段已序列化为 ISO 字符串，包含关联数据）
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
  // 关联数据
  customer: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  salesOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
  } | null;
  returnOrder: {
    id: string;
    returnOrderNumber: string;
    totalAmount: number;
  } | null;
  user: {
    id: string;
    name: string;
  } | null;
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

  const getMethodLabel = (method: RefundMethod) => {
    const methodConfig: Record<RefundMethod, string> = {
      cash: '现金',
      bank_transfer: '银行转账',
      alipay: '支付宝',
      wechat: '微信支付',
      other: '其他',
    };
    return methodConfig[method] || '其他';
  };

  const formatDate = (value?: string | null) => {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString('zh-CN');
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
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
                  className="overflow-hidden transition-shadow hover:shadow-[var(--shadow-medium)]"
                >
                  <CardContent className="p-6">
                    {/* 第一行：退款单号、状态和金额 */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                          {refund.refundNumber}
                        </h3>
                        {getStatusBadge(refund.status)}
                        <Badge variant="outline" className="text-xs">
                          {getTypeLabel(refund.refundType)}
                        </Badge>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-sm text-[hsl(var(--color-text-tertiary))]">
                          应退金额
                        </div>
                        <div className="text-2xl font-bold text-[hsl(var(--color-warning))]">
                          {formatCurrency(refund.refundAmount)}
                        </div>
                      </div>
                    </div>

                    {/* 第二行：客户和订单信息 */}
                    <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div>
                        <span className="text-[hsl(var(--color-text-tertiary))]">
                          客户：
                        </span>
                        <span className="ml-1 font-medium text-[hsl(var(--color-text-primary))]">
                          {refund.customer?.name || '未知客户'}
                        </span>
                        {refund.customer?.phone && (
                          <span className="ml-2 text-xs text-[hsl(var(--color-text-secondary))]">
                            {refund.customer.phone}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[hsl(var(--color-text-tertiary))]">
                          销售订单：
                        </span>
                        <span className="ml-1 font-medium text-[hsl(var(--color-text-primary))]">
                          {refund.salesOrder?.orderNumber || '无'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[hsl(var(--color-text-tertiary))]">
                          退货单号：
                        </span>
                        <span className="ml-1 font-medium text-[hsl(var(--color-text-primary))]">
                          {refund.returnOrder?.returnOrderNumber ||
                            refund.returnOrderNumber ||
                            '无'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[hsl(var(--color-text-tertiary))]">
                          退款方式：
                        </span>
                        <span className="ml-1 font-medium text-[hsl(var(--color-text-secondary))]">
                          {getMethodLabel(refund.refundMethod)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[hsl(var(--color-text-tertiary))]">
                          退款日期：
                        </span>
                        <span className="ml-1 font-medium text-[hsl(var(--color-text-secondary))]">
                          {formatDate(refund.refundDate)}
                        </span>
                      </div>
                      {refund.processedDate && (
                        <div>
                          <span className="text-[hsl(var(--color-text-tertiary))]">
                            处理时间：
                          </span>
                          <span className="ml-1 font-medium text-[hsl(var(--color-text-secondary))]">
                            {formatDateTime(refund.processedDate)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 第三行：退款原因 */}
                    {refund.reason && (
                      <div className="mt-3 text-sm">
                        <span className="text-[hsl(var(--color-text-tertiary))]">
                          退款原因：
                        </span>
                        <span className="ml-1 text-[hsl(var(--color-text-secondary))]">
                          {refund.reason}
                        </span>
                      </div>
                    )}

                    {/* 第四行：金额信息和操作按钮 */}
                    <div className="mt-4 flex items-center gap-6 border-t border-[hsl(var(--color-border-secondary))] pt-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                          已处理
                        </span>
                        <span className="text-lg font-semibold text-[hsl(var(--color-success))]">
                          {formatCurrency(refund.processedAmount)}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                          待处理
                        </span>
                        <span className="text-lg font-semibold text-[hsl(var(--color-warning))]">
                          {formatCurrency(refund.remainingAmount)}
                        </span>
                      </div>
                      <div className="ml-auto flex gap-2">
                        {refund.returnOrderId && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/return-orders/${refund.returnOrderId}`
                              )
                            }
                          >
                            查看退货单
                          </Button>
                        )}
                        {refund.salesOrder && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/sales-orders/${refund.salesOrder.id}`
                              )
                            }
                          >
                            查看订单
                          </Button>
                        )}
                        {(refund.status === 'pending' ||
                          refund.status === 'processing' ||
                          refund.remainingAmount > 0) && (
                          <Button
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/finance/refunds/${refund.id}/process`
                              )
                            }
                          >
                            处理退款
                          </Button>
                        )}
                      </div>
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
