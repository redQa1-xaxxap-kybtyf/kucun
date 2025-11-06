'use client';

import { Calendar, Clock, DollarSign, Eye, MoreHorizontal } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
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
import { formatDateTime } from '@/lib/utils/datetime';

import { formatCurrencyWithSign, isMeaningfulAmount } from './utils';

type ReceivablesTableListProps = {
  isLoading: boolean;
  error: unknown;
  receivables: ReceivableItem[];
  pagination?: ReceivablesResult['pagination'];
  onPageChange: (page: number) => void;
  onOpenPaymentDialog: (receivable: ReceivableItem) => void;
  onViewOrder: (orderId: string) => void;
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
}: ReceivablesTableListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (error) {
    const message = error instanceof Error ? error.message : '未知错误';
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          重新加载
        </Button>
      </div>
    );
  }

  if (!receivables.length) {
    return <EmptyState className="my-8" title="暂无应收账款数据" compact />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">订单号</TableHead>
              <TableHead className="w-[150px]">客户名称</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[120px] text-right">订单金额</TableHead>
              <TableHead className="w-[120px] text-right">应收金额</TableHead>
              <TableHead className="w-[120px] text-right">已收金额</TableHead>
              <TableHead className="w-[120px] text-right">剩余金额</TableHead>
              <TableHead className="w-[140px]">订单日期</TableHead>
              <TableHead className="w-[140px]">最后收款</TableHead>
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

      {pagination && (
        <Pagination
          pagination={pagination}
          onPageChange={onPageChange}
          showTotal
          disabled={isLoading}
          containerClassName="mt-6"
        />
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
          <span className="font-mono text-sm">{receivable.orderNumber}</span>
        </div>
      </TableCell>

      <TableCell>
        <div className="max-w-[150px] truncate" title={receivable.customerName}>
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
                    收款差额:{' '}
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
          <span>{formatDateTime(receivable.orderDate, 'yyyy-MM-dd')}</span>
          <span className="text-muted-foreground">
            {formatDateTime(receivable.orderDate, 'HH:mm')}
          </span>
        </div>
      </TableCell>

      <TableCell>
        {receivable.lastPaymentDate ? (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-3.5 w-3.5 text-green-600" />
            <span>
              {formatDateTime(receivable.lastPaymentDate, 'yyyy-MM-dd')}
            </span>
            <span className="text-green-600">
              {formatDateTime(receivable.lastPaymentDate, 'HH:mm')}
            </span>
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
              待确认收款
            </Button>
          ) : (
            amounts.actualRemaining > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onOpenPaymentDialog(receivable)}
                className="h-6 bg-green-600 px-2 text-xs text-white hover:bg-green-700"
              >
                立即收款
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
                    <DollarSign className="mr-2 h-4 w-4" />
                    立即收款
                  </DropdownMenuItem>
                )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
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
      label: '未收款',
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
      label: '待确认',
      variant: 'secondary' as BadgeProps['variant'],
    },
    confirmed: {
      label: '已确认',
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
  const paymentRoundingRaw =
    (receivable.paymentRoundingAmount ?? 0) +
    (receivable.pendingRoundingAmount ?? 0);
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
