'use client';

import { Calendar, CheckCircle, TrendingDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { CopyableText } from '@/components/common/copyable-text';
import { EmptyState } from '@/components/common/empty-state';
import { RelativeTime } from '@/components/common/relative-time';
import { SearchFilterCard } from '@/components/common/search-filter-card';
import { RefundProcessDialog } from '@/components/finance/refund-process-dialog';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  RefundListData,
  RefundListQueryParams,
  RefundMethod,
  RefundStatus,
  RefundType,
} from '@/lib/types/refund';
import { formatCurrency } from '@/lib/utils';

interface RefundsClientProps {
  data: RefundListData;
  initialParams: RefundListQueryParams;
  isLoading?: boolean;
  errorMessage?: string | null;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
  onPageChange?: (page: number) => void;
}

/**
 * 退款客户端交互组件
 * 处理搜索、筛选、分页等客户端交互
 */
export function RefundsClient({
  data,
  initialParams,
  isLoading,
  errorMessage,
  onSearch,
  onFilter,
  onDateRangeChange,
  onPageChange,
}: RefundsClientProps) {
  const router = useRouter();
  const [processDialogOpen, setProcessDialogOpen] = React.useState(false);
  const [selectedRefundId, setSelectedRefundId] = React.useState<string | null>(
    null
  );
  const { refunds, statistics, pagination } = data;
  const [searchValue, setSearchValue] = React.useState(
    initialParams.search ?? ''
  );

  React.useEffect(() => {
    setSearchValue(initialParams.search ?? '');
  }, [initialParams.search]);

  const handleDialogOpenChange = React.useCallback((open: boolean) => {
    setProcessDialogOpen(open);
    if (!open) {
      setSelectedRefundId(null);
    }
  }, []);

  const handleProcessSuccess = React.useCallback(() => {
    router.refresh();
  }, [router]);

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
      original_payment: '原路退回',
      alipay: '支付宝',
      wechat: '微信支付',
      other: '其他',
    };
    return methodConfig[method] || '其他';
  };

  const renderRefundCard = (refund: RefundListData['refunds'][number]) => {
    const showProcessButton =
      refund.status === 'pending' ||
      refund.status === 'processing' ||
      refund.remainingAmount > 0;

    return (
      <div
        key={refund.id}
        className="bg-card rounded-lg border p-3 shadow-[var(--shadow-light)] sm:p-4"
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/finance/refunds/${refund.id}`)}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            router.push(`/finance/refunds/${refund.id}`);
          }
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <span>退款单号</span>
              <span className="font-mono font-medium">
                <CopyableText text={refund.refundNumber} />
              </span>
            </div>
            <div className="text-sm font-medium">
              {refund.customer?.name || '未知客户'}
            </div>
            {refund.customer?.phone && (
              <div className="text-muted-foreground text-xs">
                {refund.customer.phone}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 text-xs">
            {getStatusBadge(refund.status)}
            <Badge variant="outline" className="w-fit text-xs">
              {getTypeLabel(refund.refundType)}
            </Badge>
          </div>
        </div>

        <div className="mt-3 space-y-2 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">关联订单：</span>
            <div className="flex flex-wrap items-center gap-2">
              {refund.salesOrder?.orderNumber && (
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground text-[11px]">销</span>
                  <CopyableText
                    text={refund.salesOrder.orderNumber}
                    className="font-mono"
                  />
                </span>
              )}
              {refund.returnOrder?.returnOrderNumber && (
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground text-[11px]">退</span>
                  <CopyableText
                    text={refund.returnOrder.returnOrderNumber}
                    className="font-mono"
                  />
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">退款方式：</span>
            <span>{getMethodLabel(refund.refundMethod)}</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3 text-xs sm:text-sm">
          <div className="space-y-1">
            <div className="text-muted-foreground">应退金额</div>
            <div className="font-mono font-bold text-[hsl(var(--color-warning))]">
              {formatCurrency(refund.refundAmount)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">已退金额</div>
            <div className="font-mono text-xs text-[hsl(var(--color-success))] sm:text-sm">
              {formatCurrency(refund.processedAmount)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">待退金额</div>
            <div className="text-muted-foreground font-mono text-xs sm:text-sm">
              {formatCurrency(
                refund.remainingAmount ??
                  refund.refundAmount - refund.processedAmount
              )}
            </div>
          </div>
        </div>

        <div className="text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>申请：</span>
            <RelativeTime date={refund.refundDate} />
          </div>
          {refund.processedDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>处理：</span>
              <RelativeTime date={refund.processedDate} />
            </div>
          )}
        </div>

        {showProcessButton && (
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="text-primary h-8 px-3 text-xs hover:bg-[hsl(var(--color-primary-light))]"
              onClick={event => {
                event.stopPropagation();
                setSelectedRefundId(refund.id);
                setProcessDialogOpen(true);
              }}
            >
              处理
            </Button>
          </div>
        )}
      </div>
    );
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
            <ChineseYuan className="h-4 w-4 text-[hsl(var(--color-info))]" />
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
      <SearchFilterCard
        searchValue={searchValue}
        onSearchChange={value => {
          setSearchValue(value);
          onSearch?.(value);
        }}
        searchPlaceholder="搜索退款单号、退货单号..."
        // 筛选器配置
        filters={[
          {
            key: 'status',
            label: '状态',
            options: [
              { label: '待处理', value: 'pending' },
              { label: '处理中', value: 'processing' },
              { label: '已完成', value: 'completed' },
              { label: '已拒绝', value: 'rejected' },
            ],
            width: 'w-[140px]',
          },
        ]}
        filterValues={{
          status: initialParams.status || 'all',
        }}
        onFilterChange={(key, value) => {
          if (key === 'status') {
            onFilter?.(key, value === 'all' ? undefined : value);
          }
        }}
        // 日期范围筛选
        dateRangeFilter={{
          key: 'dateRange',
          label: '退款日期',
          value: {
            startDate: initialParams.startDate,
            endDate: initialParams.endDate,
          },
          onChange: range => onDateRangeChange?.(range),
          placeholder: '选择退款日期范围',
        }}
        variant="elevated"
        compact={true}
      />

      <Card className="border border-[hsl(var(--color-border-secondary))] shadow-[var(--shadow-light)]">
        <CardContent className="bg-[hsl(var(--color-bg-card))] pt-6">
          {/* 退款申请列表 */}
          {errorMessage && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-md border px-3 py-2 text-sm">
              加载退款数据失败：{errorMessage}
            </div>
          )}

          {/* 桌面端：表格视图 */}
          <div className="mt-6 hidden overflow-x-auto rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">退款单号</TableHead>
                  <TableHead className="w-[100px] text-center">状态</TableHead>
                  <TableHead className="w-[150px]">客户信息</TableHead>
                  <TableHead className="w-[200px]">关联订单</TableHead>
                  <TableHead className="w-[100px]">退款方式</TableHead>
                  <TableHead className="w-[150px] text-right">
                    金额信息
                  </TableHead>
                  <TableHead className="w-[150px] text-center">
                    时间信息
                  </TableHead>
                  <TableHead className="w-[120px] text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && refunds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : refunds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <EmptyState title="暂无退款记录" compact />
                    </TableCell>
                  </TableRow>
                ) : (
                  refunds.map(refund => (
                    <TableRow
                      key={refund.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        router.push(`/finance/refunds/${refund.id}`);
                      }}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="font-mono font-medium">
                            <CopyableText text={refund.refundNumber} />
                          </div>
                          <Badge variant="outline" className="w-fit text-xs">
                            {getTypeLabel(refund.refundType)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(refund.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          <span className="font-medium">
                            {refund.customer?.name || '未知客户'}
                          </span>
                          {refund.customer?.phone && (
                            <span className="text-muted-foreground text-xs">
                              {refund.customer.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {refund.salesOrder?.orderNumber && (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground text-xs">
                                销:
                              </span>
                              <CopyableText
                                text={refund.salesOrder.orderNumber}
                                className="font-mono"
                              />
                            </div>
                          )}
                          {(refund.returnOrder?.returnOrderNumber ||
                            refund.returnOrderNumber) && (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground text-xs">
                                退:
                              </span>
                              <CopyableText
                                text={
                                  refund.returnOrder?.returnOrderNumber ||
                                  refund.returnOrderNumber ||
                                  ''
                                }
                                className="font-mono"
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {getMethodLabel(refund.refundMethod)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col gap-1">
                          <div className="font-mono font-bold text-[hsl(var(--color-warning))]">
                            {formatCurrency(refund.refundAmount)}
                          </div>
                          {refund.processedAmount > 0 && (
                            <div className="text-xs text-[hsl(var(--color-success))]">
                              已退: {formatCurrency(refund.processedAmount)}
                            </div>
                          )}
                          {refund.remainingAmount > 0 &&
                            refund.remainingAmount < refund.refundAmount && (
                              <div className="text-muted-foreground text-xs">
                                待退: {formatCurrency(refund.remainingAmount)}
                              </div>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col gap-1 text-sm">
                          <div className="text-muted-foreground flex items-center justify-center gap-1">
                            <span className="text-xs">申:</span>
                            <RelativeTime date={refund.refundDate} />
                          </div>
                          {refund.processedDate && (
                            <div className="text-muted-foreground flex items-center justify-center gap-1">
                              <span className="text-xs">处:</span>
                              <RelativeTime date={refund.processedDate} />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {(refund.status === 'pending' ||
                            refund.status === 'processing' ||
                            refund.remainingAmount > 0) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-primary hover:text-primary/80 h-8 px-2 hover:bg-[hsl(var(--color-primary-light))]"
                              onClick={event => {
                                event.stopPropagation();
                                setSelectedRefundId(refund.id);
                                setProcessDialogOpen(true);
                              }}
                            >
                              处理
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 移动端：卡片列表视图 */}
          <div className="mt-4 space-y-3 md:hidden">
            {isLoading && refunds.length === 0 ? (
              <div className="text-muted-foreground flex items-center justify-center rounded-md border bg-[hsl(var(--color-bg-muted))] p-6 text-sm">
                加载中...
              </div>
            ) : refunds.length === 0 ? (
              <EmptyState title="暂无退款记录" compact />
            ) : (
              refunds.map(refund => renderRefundCard(refund))
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
      <RefundProcessDialog
        refundId={selectedRefundId}
        open={processDialogOpen && !!selectedRefundId}
        onOpenChange={handleDialogOpenChange}
        onSuccess={handleProcessSuccess}
      />
    </div>
  );
}
