'use client';

import {
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  MoreHorizontal,
  Receipt,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { CopyableText } from '@/components/common/copyable-text';
import { EmptyState } from '@/components/common/empty-state';
import { RelativeTime } from '@/components/common/relative-time';
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
import type { PaymentStatus } from '@/lib/types/payment';
import { formatCurrency } from '@/lib/utils/format';

interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: PaymentStatus;
  remarks?: string;
  receiptNumber?: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
  };
  salesOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    roundingAdjustment: number;
    paidAmount: number;
    pendingAmount: number;
    remainingAmount: number;
  };
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PaymentsTableListProps {
  payments: PaymentRecord[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  onConfirm?: (paymentId: string) => void;
  confirmingId?: string | null;
  isConfirming?: boolean;
}

/**
 * 收款记录表格列表组件
 * 参考应收货款页面的表格布局设计
 */
export function PaymentsTableList({
  payments,
  pagination,
  onPageChange,
  onConfirm,
  confirmingId,
  isConfirming,
}: PaymentsTableListProps) {
  if (!payments.length) {
    return (
      <EmptyState
        icon={<Receipt className="text-muted-foreground h-8 w-8" />}
        title="暂无收款记录"
        compact
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">收款单号</TableHead>
              <TableHead className="w-[120px]">关联订单</TableHead>
              <TableHead className="w-[120px]">客户名称</TableHead>
              <TableHead className="w-[100px]">收款类型</TableHead>
              <TableHead className="w-[100px]">收款方式</TableHead>
              <TableHead className="w-[110px] text-right">应收金额</TableHead>
              <TableHead className="w-[110px] text-right">实际到账</TableHead>
              <TableHead className="w-[100px] text-right">收款差额</TableHead>
              <TableHead className="w-[140px]">收款日期</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[120px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map(payment => (
              <PaymentTableRow
                key={payment.id}
                payment={payment}
                onConfirm={onConfirm}
                confirmingId={confirmingId}
                isConfirming={isConfirming}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && onPageChange && (
        <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
          <Pagination
            pagination={pagination}
            onPageChange={onPageChange}
            showRange
            showTotal
          />
        </div>
      )}
    </div>
  );
}

interface PaymentTableRowProps {
  payment: PaymentRecord;
  onConfirm?: (paymentId: string) => void;
  confirmingId?: string | null;
  isConfirming?: boolean;
}

function PaymentTableRow({
  payment,
  onConfirm,
  confirmingId,
  isConfirming,
}: PaymentTableRowProps) {
  return (
    <TableRow className="hover:bg-muted/50">
      {/* 收款单号 */}
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">
            <CopyableText text={payment.paymentNumber} />
          </span>
        </div>
      </TableCell>

      {/* 关联订单 */}
      <TableCell>
        <Link
          href={`/sales-orders/${payment.salesOrder.id}`}
          className="text-primary font-mono text-sm hover:underline"
        >
          <CopyableText text={payment.salesOrder.orderNumber} />
        </Link>
      </TableCell>

      {/* 客户名称 */}
      <TableCell>
        <div className="max-w-[120px] truncate" title={payment.customer.name}>
          {payment.customer.name}
        </div>
      </TableCell>

      {/* 收款类型 */}
      <TableCell>
        <Badge variant="outline" className="text-xs">
          订单收款
        </Badge>
      </TableCell>

      {/* 收款方式 */}
      <TableCell>
        <PaymentMethodBadge method={payment.paymentMethod} />
      </TableCell>

      {/* 应收金额 */}
      <TableCell className="text-right">
        <div className="font-medium text-orange-600">
          {formatCurrency(payment.paymentAmount)}
        </div>
      </TableCell>

      {/* 实际到账金额 */}
      <TableCell className="text-right">
        <div className="font-medium text-green-600">
          {formatCurrency(payment.actualPaymentAmount)}
        </div>
      </TableCell>

      {/* 收款差额 */}
      <TableCell className="text-right">
        <RoundingAmountDisplay amount={payment.roundingAmount} />
      </TableCell>

      {/* 收款日期 */}
      <TableCell>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="text-muted-foreground h-3.5 w-3.5" />
          <RelativeTime date={payment.paymentDate} />
        </div>
      </TableCell>

      {/* 状态 */}
      <TableCell>
        <StatusBadge status={payment.status} />
      </TableCell>

      {/* 操作 */}
      <TableCell>
        <PaymentRowActions
          payment={payment}
          onConfirm={onConfirm}
          confirmingId={confirmingId}
          isConfirming={isConfirming}
        />
      </TableCell>
    </TableRow>
  );
}

/**
 * 状态徽章组件
 */
function StatusBadge({ status }: { status: PaymentStatus }) {
  const statusConfig: Record<
    PaymentStatus,
    { label: string; variant: BadgeProps['variant']; icon: React.ElementType }
  > = {
    pending: { label: '待确认', variant: 'secondary', icon: Clock },
    confirmed: { label: '已确认', variant: 'default', icon: CheckCircle },
    applied: { label: '已冲抵', variant: 'outline', icon: Receipt },
    cancelled: { label: '已取消', variant: 'destructive', icon: XCircle },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

/**
 * 收款方式徽章组件 - 使用CSS变量统一颜色
 * ✅ 使用项目定义的CSS变量替代硬编码颜色
 */
function PaymentMethodBadge({ method }: { method: string }) {
  const methodConfig: Record<string, { label: string; className: string }> = {
    cash: {
      label: '现金',
      className:
        'border-[hsl(var(--color-success-light))] bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]',
    },
    bank_transfer: {
      label: '银行转账',
      className:
        'border-[hsl(var(--color-info-light))] bg-[hsl(var(--color-info-light))] text-[hsl(var(--color-info))]',
    },
    alipay: {
      label: '支付宝',
      className:
        'border-[hsl(var(--color-info-light))] bg-[hsl(var(--color-info-light))] text-[hsl(var(--color-info))]',
    },
    wechat: {
      label: '微信支付',
      className:
        'border-[hsl(var(--color-success-light))] bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]',
    },
  };

  const config = methodConfig[method] || {
    label: method,
    className:
      'border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-tertiary))] text-[hsl(var(--color-text-secondary))]',
  };

  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
}

/**
 * 收款差额显示组件
 */
function RoundingAmountDisplay({ amount }: { amount: number }) {
  if (amount === 0) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div
            className={`cursor-help text-sm font-medium ${
              amount < 0 ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {amount < 0 ? '+' : '-'}
            {formatCurrency(Math.abs(amount))}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {amount < 0 ? '多收' : '少收'} {formatCurrency(Math.abs(amount))}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * 操作按钮组件
 */
interface PaymentRowActionsProps {
  payment: PaymentRecord;
  onConfirm?: (paymentId: string) => void;
  confirmingId?: string | null;
  isConfirming?: boolean;
}

function PaymentRowActions({
  payment,
  onConfirm,
  confirmingId,
  isConfirming,
}: PaymentRowActionsProps) {
  return (
    <div className="flex items-center justify-center gap-1">
      {payment.status === 'pending' && onConfirm && (
        <Button
          variant="default"
          size="sm"
          onClick={() => onConfirm(payment.id)}
          disabled={confirmingId === payment.id || isConfirming}
          className="h-6 bg-green-600 px-2 text-xs text-white hover:bg-green-700"
        >
          {confirmingId === payment.id ? '确认中...' : '确认收款'}
        </Button>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
              <Link href={`/finance/payments/${payment.id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>查看详情</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/finance/payments/${payment.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              查看详情
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/sales-orders/${payment.salesOrder.id}`}>
              <Receipt className="mr-2 h-4 w-4" />
              查看订单
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
