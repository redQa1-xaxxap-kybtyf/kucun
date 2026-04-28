'use client';

import { Calendar, Clock, Eye, MoreHorizontal } from 'lucide-react';

import { CopyableText } from '@/components/common/copyable-text';
import { EmptyState } from '@/components/common/empty-state';
import { RelativeTime } from '@/components/common/relative-time';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton-compositions';
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
import type {
  PaymentStatus,
  ReceivableItem,
  ReceivablesResult,
} from '@/lib/services/receivables-service';
import { formatCurrency } from '@/lib/utils';
import { formatDate } from '@/lib/utils/datetime';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

import { formatCurrencyWithSign, isMeaningfulAmount } from './utils';

type ReceivablesTableListProps = {
  isLoading: boolean;
  error: unknown;
  receivables: ReceivableItem[];
  pagination?: ReceivablesResult['pagination'];
  onPageChange: (page: number) => void;
  onOpenPaymentDialog: (receivable: ReceivableItem) => void;
  onViewOrder: (orderId: string) => void;
  onRetry: () => void;
};

/**
 * 应收账款表格列表组件
 * 参考销售订单列表样式，采用表格布局展示应收账款信息
 */
export function ReceivablesTableList({
  isLoading,
  error,
  receivables,
  pagination,
  onPageChange,
  onOpenPaymentDialog,
  onViewOrder,
  onRetry,
}: ReceivablesTableListProps) {
  if (isLoading) {
    return <TableSkeleton columns={9} rows={8} showPagination />;
  }

  if (error) {
    const message = getFriendlyErrorMessage(
      error,
      '应收账款暂时无法加载，请稍后重试'
    );
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-[hsl(var(--color-error-light))] bg-[hsl(var(--color-error-lighter))] p-8">
        <div className="text-center">
          <p className="text-lg font-semibold text-[hsl(var(--color-error))]">
            加载失败
          </p>
          <p className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
            {message}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          重试
        </Button>
      </div>
    );
  }

  if (!receivables.length) {
    return <EmptyState className="my-8" title="暂无应收账款" compact />;
  }

  return (
    <div className="space-y-4">
      {/* 桌面端：宽表格 + 横向滚动 */}
      <div className="hidden overflow-x-auto rounded-md border lg:block">
        <Table className="min-w-[1120px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">订单号</TableHead>
              <TableHead className="w-[130px]">客户名称</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[110px] text-right">订单金额</TableHead>
              <TableHead className="w-[110px] text-right">应收金额</TableHead>
              <TableHead className="w-[110px] text-right">已收金额</TableHead>
              <TableHead className="w-[110px] text-right">待收金额</TableHead>
              <TableHead className="w-[120px]">订单日期</TableHead>
              <TableHead className="w-[120px]">最后收款</TableHead>
              <TableHead className="w-[100px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receivables.map(receivable => (
              <ReceivableTableRow
                key={receivable.id}
                receivable={receivable}
                onOpenPaymentDialog={onOpenPaymentDialog}
                onViewOrder={onViewOrder}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 小屏端：卡片视图 */}
      <div className="grid gap-3 lg:hidden">
        {receivables.map(receivable => (
          <ReceivableCard
            key={receivable.id}
            receivable={receivable}
            onOpenPaymentDialog={onOpenPaymentDialog}
            onViewOrder={onViewOrder}
          />
        ))}
      </div>

      {pagination && (
        <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
          <Pagination
            pagination={pagination}
            onPageChange={onPageChange}
            showRange
            showTotal
            disabled={isLoading}
          />
        </div>
      )}
    </div>
  );
}

type ReceivableTableRowProps = {
  receivable: ReceivableItem;
  onOpenPaymentDialog: (receivable: ReceivableItem) => void;
  onViewOrder: (orderId: string) => void;
};

function ReceivableTableRow({
  receivable,
  onOpenPaymentDialog,
  onViewOrder,
}: ReceivableTableRowProps) {
  const amounts = getReceivableAmounts(receivable);

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">
            <CopyableText text={receivable.orderNumber} />
          </span>
        </div>
      </TableCell>

      <TableCell>
        <div className="max-w-[130px] truncate" title={receivable.customerName}>
          {receivable.customerName}
        </div>
      </TableCell>

      <TableCell>
        <ReceivableStatusBadge status={receivable.paymentStatus} />
      </TableCell>

      <TableCell className="text-right">
        <div className="space-y-1">
          <div className="font-medium">
            {formatCurrency(amounts.orderActualAmount)}
          </div>
          {amounts.hasOrderRounding && (
            <div className="text-xs text-green-600">
              抹零 {formatCurrency(amounts.orderRoundingDisplay)}
            </div>
          )}
        </div>
      </TableCell>

      <TableCell className="text-right">
        <div className="font-medium text-orange-600">
          {formatCurrency(amounts.receivableAmount)}
        </div>
      </TableCell>

      <TableCell className="text-right">
        <div className="space-y-1">
          <div className="font-medium text-green-600">
            {formatCurrency(amounts.paidActual)}
          </div>
          {amounts.hasPaymentRounding && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div
                    className={`cursor-help text-xs ${
                      amounts.paymentRoundingDisplay > 0
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}
                  >
                    {amounts.paymentRoundingDisplay > 0 ? '多收' : '少收'}
                    {formatCurrency(Math.abs(amounts.paymentRoundingDisplay))}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    抹零金额:{' '}
                    {formatCurrencyWithSign(amounts.paymentRoundingDisplay)}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>

      <TableCell className="text-right">
        <div
          className={`font-medium ${
            amounts.actualRemaining > 0 ? 'text-orange-600' : 'text-green-600'
          }`}
        >
          {formatCurrency(amounts.actualRemaining)}
        </div>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="text-muted-foreground h-3.5 w-3.5" />
          <span>{formatDate(receivable.orderDate)}</span>
        </div>
      </TableCell>

      <TableCell>
        {receivable.lastPaymentDate ? (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-3.5 w-3.5 text-green-600" />
            <RelativeTime date={receivable.lastPaymentDate} />
          </div>
        ) : (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Clock className="h-3.5 w-3.5" />
            <span>暂无收款</span>
          </div>
        )}
      </TableCell>

      <TableCell>
        <div className="flex items-center justify-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewOrder(receivable.id)}
                  className="h-8 w-8 p-0"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>查看订单详情</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {receivable.paymentStatus === 'pending' ? (
            <Button
              variant="outline"
              size="sm"
              disabled
              className="h-6 cursor-not-allowed border-gray-300 bg-gray-50 px-2 text-xs text-gray-500"
            >
              已有待确认
            </Button>
          ) : (
            amounts.actualRemaining > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onOpenPaymentDialog(receivable)}
                className="h-6 bg-green-600 px-2 text-xs text-white hover:bg-green-700"
              >
                登记收款
              </Button>
            )
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewOrder(receivable.id)}>
                <Eye className="mr-2 h-4 w-4" />
                查看详情
              </DropdownMenuItem>
              {amounts.actualRemaining > 0 &&
                receivable.paymentStatus !== 'pending' && (
                  <DropdownMenuItem
                    onClick={() => onOpenPaymentDialog(receivable)}
                    className="text-green-600"
                  >
                    <ChineseYuan className="mr-2 h-4 w-4" />
                    登记收款
                  </DropdownMenuItem>
                )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ReceivableCard({
  receivable,
  onOpenPaymentDialog,
  onViewOrder,
}: ReceivableTableRowProps) {
  const amounts = getReceivableAmounts(receivable);

  return (
    <div className="bg-card rounded-md border p-3 shadow-sm sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <span>订单号</span>
            <span className="font-mono">
              <CopyableText text={receivable.orderNumber} />
            </span>
          </div>
          <div
            className="max-w-[220px] truncate text-sm font-medium"
            title={receivable.customerName}
          >
            {receivable.customerName}
          </div>
        </div>
        <ReceivableStatusBadge status={receivable.paymentStatus} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:text-sm">
        <div className="space-y-1">
          <div className="text-muted-foreground">订单金额</div>
          <div className="font-medium">
            {formatCurrency(amounts.orderActualAmount)}
          </div>
        </div>
        <div className="space-y-1 text-right">
          <div className="text-muted-foreground">应收金额</div>
          <div className="font-medium text-orange-600">
            {formatCurrency(amounts.receivableAmount)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">已收金额</div>
          <div className="font-medium text-green-600">
            {formatCurrency(amounts.paidActual)}
          </div>
        </div>
        <div className="space-y-1 text-right">
          <div className="text-muted-foreground">待收金额</div>
          <div
            className={`font-medium ${
              amounts.actualRemaining > 0 ? 'text-orange-600' : 'text-green-600'
            }`}
          >
            {formatCurrency(amounts.actualRemaining)}
          </div>
        </div>
      </div>

      <div className="text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>订单：</span>
          <span>{formatDate(receivable.orderDate)}</span>
        </div>
        <div className="flex items-center gap-1">
          {receivable.lastPaymentDate ? (
            <>
              <Calendar className="h-3.5 w-3.5 text-green-600" />
              <span>最后收款：</span>
              <RelativeTime date={receivable.lastPaymentDate} />
            </>
          ) : (
            <>
              <Clock className="h-3.5 w-3.5" />
              <span>暂无收款</span>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewOrder(receivable.id)}
            className="h-8 px-3 text-xs"
          >
            <Eye className="mr-1 h-3.5 w-3.5" />
            查看订单
          </Button>

          {receivable.paymentStatus === 'pending' ? (
            <Button
              variant="outline"
              size="sm"
              disabled
              className="h-8 cursor-not-allowed border-gray-300 bg-gray-50 px-3 text-xs text-gray-500"
            >
              已有待确认
            </Button>
          ) : (
            amounts.actualRemaining > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onOpenPaymentDialog(receivable)}
                className="h-8 bg-green-600 px-3 text-xs text-white hover:bg-green-700"
              >
                登记收款
              </Button>
            )
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewOrder(receivable.id)}>
              <Eye className="mr-2 h-4 w-4" />
              查看详情
            </DropdownMenuItem>
            {amounts.actualRemaining > 0 &&
              receivable.paymentStatus !== 'pending' && (
                <DropdownMenuItem
                  onClick={() => onOpenPaymentDialog(receivable)}
                  className="text-green-600"
                >
                  <ChineseYuan className="mr-2 h-4 w-4" />
                  登记收款
                </DropdownMenuItem>
              )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

type StatusConfigItem = {
  label: string;
  variant: BadgeProps['variant'];
  className?: string;
};

const STATUS_CONFIG: Partial<Record<PaymentStatus | string, StatusConfigItem>> =
  {
    unpaid: {
      label: '待收款',
      variant: 'destructive' as BadgeProps['variant'],
    },
    partial: {
      label: '部分收款',
      variant: 'outline' as BadgeProps['variant'],
      className: 'border-yellow-300 bg-yellow-50 text-yellow-700',
    },
    paid: {
      label: '已收款',
      variant: 'default' as BadgeProps['variant'],
    },
    pending: {
      label: '待确认到账',
      variant: 'secondary' as BadgeProps['variant'],
    },
    confirmed: {
      label: '已到账',
      variant: 'default' as BadgeProps['variant'],
    },
    cancelled: {
      label: '已取消',
      variant: 'secondary' as BadgeProps['variant'],
    },
  };

function ReceivableStatusBadge({ status }: { status: PaymentStatus | string }) {
  const config = STATUS_CONFIG[status] ?? {
    label: '未知状态',
    variant: 'secondary' as BadgeProps['variant'],
  };

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

type ReceivableAmounts = {
  orderActualAmount: number;
  orderRoundingDisplay: number;
  hasOrderRounding: boolean;
  paymentRoundingDisplay: number;
  hasPaymentRounding: boolean;
  receivableAmount: number;
  paidActual: number;
  actualRemaining: number;
};

function getReceivableAmounts(receivable: ReceivableItem): ReceivableAmounts {
  const productAmount = receivable.totalAmount;
  const orderRoundingRaw = receivable.roundingAdjustment ?? 0;
  // ✅ P1修复: 只使用已确认的抹零计算剩余金额
  // 待确认的抹零不参与剩余金额计算
  const paymentRoundingRaw = receivable.paymentRoundingAmount ?? 0;
  const paidActual = receivable.paidAmount ?? 0;

  const orderActualAmount = productAmount + orderRoundingRaw;
  const receivableAmount = orderActualAmount - paymentRoundingRaw;
  const actualRemaining = receivableAmount - paidActual;

  return {
    orderActualAmount,
    orderRoundingDisplay: Math.abs(orderRoundingRaw),
    hasOrderRounding: isMeaningfulAmount(orderRoundingRaw),
    paymentRoundingDisplay: -paymentRoundingRaw,
    hasPaymentRounding: isMeaningfulAmount(paymentRoundingRaw),
    receivableAmount,
    paidActual,
    actualRemaining,
  };
}
