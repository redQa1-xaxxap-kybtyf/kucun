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
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';

interface PaymentOutRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
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
  onVoid?: (payment: PaymentOutRecord) => void;
  confirmingId?: string | null;
  isConfirming?: boolean;
  isVoiding?: boolean;
}

/**
 * 付款记录表格列表组件
 */
export function PaymentsOutTableList({
  payments,
  pagination,
  onPageChange,
  onConfirm,
  onVoid,
  confirmingId,
  isConfirming,
  isVoiding,
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
      {/* 桌面端：宽表格 + 横向滚动 */}
      <div className="hidden overflow-x-auto rounded-md border 2xl:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">付款单号</TableHead>
              <TableHead className="w-[140px]">关联应付款</TableHead>
              <TableHead className="w-[150px]">供应商</TableHead>
              <TableHead className="w-[100px]">付款方式</TableHead>
              <TableHead className="w-[110px] text-right">记账金额</TableHead>
              <TableHead className="w-[110px] text-right">实际付款</TableHead>
              <TableHead className="w-[100px] text-right">抹零差额</TableHead>
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
                onVoid={onVoid}
                confirmingId={confirmingId}
                isConfirming={isConfirming}
                isVoiding={isVoiding}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 移动端：卡片列表 */}
      <div className="grid gap-3 xl:grid-cols-2 2xl:hidden">
        {payments.map(payment => (
          <PaymentOutCard
            key={payment.id}
            payment={payment}
            onConfirm={onConfirm}
            onVoid={onVoid}
            confirmingId={confirmingId}
            isConfirming={isConfirming}
            isVoiding={isVoiding}
          />
        ))}
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
  onVoid,
  confirmingId,
  isConfirming,
  isVoiding,
}: {
  payment: PaymentOutRecord;
  onConfirm?: (paymentId: string) => void;
  onVoid?: (payment: PaymentOutRecord) => void;
  confirmingId?: string | null;
  isConfirming?: boolean;
  isVoiding?: boolean;
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
            className="text-primary font-mono text-sm hover:underline"
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

      {/* 记账金额 */}
      <TableCell className="text-right">
        <div className="font-medium text-[hsl(var(--color-primary))]">
          {formatCurrency(payment.paymentAmount)}
        </div>
      </TableCell>

      {/* 实际付款 */}
      <TableCell className="text-right">
        <div className="font-medium text-green-600">
          {formatCurrency(payment.actualPaymentAmount)}
        </div>
      </TableCell>

      {/* 抹零差额 */}
      <TableCell className="text-right">
        <RoundingAmountDisplay amount={payment.roundingAmount} />
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
          onVoid={onVoid}
          confirmingId={confirmingId}
          isConfirming={isConfirming}
          isVoiding={isVoiding}
        />
      </TableCell>
    </TableRow>
  );
}

function PaymentOutCard({
  payment,
  onConfirm,
  onVoid,
  confirmingId,
  isConfirming,
  isVoiding,
}: {
  payment: PaymentOutRecord;
  onConfirm?: (paymentId: string) => void;
  onVoid?: (payment: PaymentOutRecord) => void;
  confirmingId?: string | null;
  isConfirming?: boolean;
  isVoiding?: boolean;
}) {
  const isThisConfirming = isConfirming && confirmingId === payment.id;
  const primaryActionsClass = cn(
    'grid gap-2',
    payment.status === 'pending' && onConfirm ? 'grid-cols-2' : 'grid-cols-1'
  );

  return (
    <div className="bg-card rounded-lg border p-3 shadow-[var(--shadow-light)] sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <span>付款单号</span>
            <span className="font-mono">
              <CopyableText text={payment.paymentNumber} />
            </span>
          </div>
          <div className="text-sm leading-5 font-medium break-words">
            {payment.supplier.name}
          </div>
          {payment.supplier.phone && (
            <div className="text-muted-foreground text-xs">
              {payment.supplier.phone}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 text-xs">
          <StatusBadge status={payment.status} />
          <PaymentMethodBadge method={payment.paymentMethod} />
        </div>
      </div>

      <div className="mt-3 space-y-2 text-xs sm:text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">关联应付款：</span>
          {payment.payableRecord ? (
            <Link
              href={`/finance/payables/${payment.payableRecord.id}`}
              className="text-primary font-mono hover:underline"
            >
              <CopyableText text={payment.payableRecord.payableNumber} />
            </Link>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-xs sm:text-sm">
        <div className="space-y-1">
          <div className="text-muted-foreground">记账金额</div>
          <div className="font-medium text-[hsl(var(--color-primary))]">
            {formatCurrency(payment.paymentAmount)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">实际付款</div>
          <div className="font-medium text-green-600">
            {formatCurrency(payment.actualPaymentAmount)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">抹零差额</div>
          <RoundingAmountDisplay amount={payment.roundingAmount} />
        </div>
      </div>

      <div className="mt-3 text-xs sm:text-sm">
        <span className="text-muted-foreground">经办人：</span>
        <span>{payment.user.name}</span>
      </div>

      <div className="text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>付款：</span>
          <RelativeTime date={payment.paymentDate} />
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <span>创建：</span>
          <RelativeTime date={payment.createdAt} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] items-start gap-2">
        <div className={primaryActionsClass}>
          {payment.status === 'pending' && (
            <>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-9 w-full justify-center px-3 text-xs"
              >
                <Link href={`/finance/payments-out/${payment.id}/edit`}>
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  编辑
                </Link>
              </Button>
              {onConfirm && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onConfirm(payment.id)}
                  disabled={isConfirming || Boolean(isVoiding)}
                  className="h-9 w-full bg-green-600 px-3 text-xs text-white hover:bg-green-700"
                >
                  {isThisConfirming ? '确认中...' : '确认付款'}
                </Button>
              )}
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-9 w-full justify-center px-3 text-xs"
          >
            <Link href={`/finance/payments-out/${payment.id}`}>
              <Eye className="mr-1 h-3.5 w-3.5" />
              查看详情
            </Link>
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg"
            >
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
                    disabled={isConfirming || Boolean(isVoiding)}
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
            {onVoid && payment.status !== 'cancelled' && (
              <DropdownMenuItem
                onClick={() => onVoid(payment)}
                disabled={isVoiding}
                className="text-destructive focus:text-destructive"
              >
                <XCircle className="mr-2 h-4 w-4" />
                {isVoiding ? '作废中...' : '作废付款'}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
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
    cancelled: { label: '已作废', variant: 'destructive', icon: XCircle },
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

function RoundingAmountDisplay({ amount }: { amount: number }) {
  if (amount === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <span className={amount < 0 ? 'text-red-600' : 'text-orange-600'}>
      {amount < 0 ? '+' : '-'}
      {formatCurrency(Math.abs(amount))}
    </span>
  );
}

/**
 * 操作按钮组件
 */
function PaymentOutRowActions({
  payment,
  onConfirm,
  onVoid,
  confirmingId,
  isConfirming,
  isVoiding,
}: {
  payment: PaymentOutRecord;
  onConfirm?: (paymentId: string) => void;
  onVoid?: (payment: PaymentOutRecord) => void;
  confirmingId?: string | null;
  isConfirming?: boolean;
  isVoiding?: boolean;
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
                    disabled={isConfirming || Boolean(isVoiding)}
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
                  disabled={isConfirming || Boolean(isVoiding)}
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
          {onVoid && payment.status !== 'cancelled' && (
            <DropdownMenuItem
              onClick={() => onVoid(payment)}
              disabled={isVoiding}
              className="text-destructive focus:text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              {isVoiding ? '作废中...' : '作废付款'}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
