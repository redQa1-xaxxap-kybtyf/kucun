'use client';

import {
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  MoreHorizontal,
  Pencil,
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
import { formatCurrency } from '@/lib/utils/format';

interface PaymentOutRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  voucherNumber?: string;
  payableRecord?: {
    id: string;
    payableNumber: string;
    payableAmount: number;
    remainingAmount: number;
  };
  supplier: {
    id: string;
    name: string;
    phone?: string;
  };
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PaymentsOutTableListProps {
  payments: PaymentOutRecord[];
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
 * 付款记录表格列表组件
 */
export function PaymentsOutTableList({
  payments,
  pagination,
  onPageChange,
  onConfirm,
  confirmingId,
  isConfirming,
}: PaymentsOutTableListProps) {
  if (!payments.length) {
    return (
      <EmptyState
        icon={<Receipt className="text-muted-foreground h-8 w-8" />}
        title="暂无付款记录"
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
              <TableHead className="w-[140px]">付款单号</TableHead>
              <TableHead className="w-[140px]">关联应付款</TableHead>
              <TableHead className="w-[150px]">供应商</TableHead>
              <TableHead className="w-[100px]">付款方式</TableHead>
              <TableHead className="w-[120px] text-right">付款金额</TableHead>
              <TableHead className="w-[140px]">付款日期</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[120px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map(payment => (
              <PaymentOutTableRow
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

function PaymentOutTableRow({
  payment,
  onConfirm,
  confirmingId,
  isConfirming,
}: {
  payment: PaymentOutRecord;
  onConfirm?: (paymentId: string) => void;
  confirmingId?: string | null;
  isConfirming?: boolean;
}) {
  return (
    <TableRow className="hover:bg-muted/50">
      {/* 付款单号 */}
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">
            <CopyableText text={payment.paymentNumber} />
          </span>
        </div>
      </TableCell>

      {/* 关联应付款 */}
      <TableCell>
        {payment.payableRecord ? (
          <Link
            href={`/finance/payables/${payment.payableRecord.id}`}
            className="font-mono text-sm text-blue-600 hover:underline"
          >
            <CopyableText text={payment.payableRecord.payableNumber} />
          </Link>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>

      {/* 供应商 */}
      <TableCell>
        <div className="max-w-[150px] truncate" title={payment.supplier.name}>
          {payment.supplier.name}
        </div>
      </TableCell>

      {/* 付款方式 */}
      <TableCell>
        <PaymentMethodBadge method={payment.paymentMethod} />
      </TableCell>

      {/* 付款金额 */}
      <TableCell className="text-right">
        <div className="font-medium text-[hsl(var(--color-primary))]">
          {formatCurrency(payment.paymentAmount)}
        </div>
      </TableCell>

      {/* 付款日期 */}
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
        <PaymentOutRowActions
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
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<
    string,
    { label: string; variant: BadgeProps['variant']; icon: React.ElementType }
  > = {
    pending: { label: '待确认', variant: 'secondary', icon: Clock },
    confirmed: { label: '已确认', variant: 'default', icon: CheckCircle },
    cancelled: { label: '已取消', variant: 'destructive', icon: XCircle },
  };

  const config = statusConfig[status] || {
    label: status,
    variant: 'secondary',
    icon: Clock,
  };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

/**
 * 付款方式徽章组件
 */
function PaymentMethodBadge({ method }: { method: string }) {
  const methodLabels: Record<string, string> = {
    cash: '现金',
    bank_transfer: '银行转账',
    alipay: '支付宝',
    wechat: '微信',
    check: '支票',
    other: '其他',
  };

  return (
    <Badge variant="outline" className="gap-1">
      <Receipt className="h-3 w-3" />
      {methodLabels[method] || method}
    </Badge>
  );
}

/**
 * 操作按钮组件
 */
function PaymentOutRowActions({
  payment,
  onConfirm,
  confirmingId,
  isConfirming,
}: {
  payment: PaymentOutRecord;
  onConfirm?: (paymentId: string) => void;
  confirmingId?: string | null;
  isConfirming?: boolean;
}) {
  const isThisConfirming = isConfirming && confirmingId === payment.id;

  return (
    <div className="flex items-center justify-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
              <Link href={`/finance/payments-out/${payment.id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>查看详情</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {payment.status === 'pending' && (
        <>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 w-8 p-0"
                >
                  <Link href={`/finance/payments-out/${payment.id}/edit`}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>编辑</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {onConfirm && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                    onClick={() => onConfirm(payment.id)}
                    disabled={isConfirming}
                  >
                    {isThisConfirming ? (
                      <Clock className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>确认付款</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/finance/payments-out/${payment.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              查看详情
            </Link>
          </DropdownMenuItem>
          {payment.status === 'pending' && (
            <>
              <DropdownMenuItem asChild>
                <Link href={`/finance/payments-out/${payment.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  编辑
                </Link>
              </DropdownMenuItem>
              {onConfirm && (
                <DropdownMenuItem
                  onClick={() => onConfirm(payment.id)}
                  disabled={isConfirming}
                  className="text-green-600 focus:text-green-700"
                >
                  {isThisConfirming ? (
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  确认付款
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
