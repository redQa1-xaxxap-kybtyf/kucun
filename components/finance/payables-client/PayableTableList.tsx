'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Eye, MoreHorizontal, Trash2 } from 'lucide-react';
import * as React from 'react';

import { CopyableText } from '@/components/common/copyable-text';
import { EmptyState } from '@/components/common/empty-state';
import { RelativeTime } from '@/components/common/relative-time';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  PAYABLE_SOURCE_TYPE_LABELS,
  PAYABLE_STATUS_LABELS,
  PAYABLE_STATUS_VARIANTS,
  type PayableRecordDetail,
} from '@/lib/types/payable';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { formatDateTime } from '@/lib/utils/datetime';
import { formatCurrency } from '@/lib/utils/format';

interface Props {
  items: PayableRecordDetail[];
  isLoading: boolean;
  onView: (id: string) => void;
  onPayNow: (id: string) => void;
}

type HeaderAlign = 'left' | 'right' | 'center';

const TABLE_HEADERS: Array<{
  key: string;
  label: string;
  align?: HeaderAlign;
}> = [
  { key: 'payableNumber', label: '应付单号' },
  { key: 'supplier', label: '供应商' },
  { key: 'sourceType', label: '来源类型' },
  { key: 'status', label: '状态' },
  { key: 'payableAmount', label: '应付金额', align: 'right' },
  { key: 'paidAmount', label: '已付金额', align: 'right' },
  { key: 'remainingAmount', label: '待付金额', align: 'right' },
  { key: 'paymentStatus', label: '付款状态' },
  { key: 'dueDate', label: '到期日' },
  { key: 'createdAt', label: '创建时间' },
  { key: 'actions', label: '操作', align: 'center' },
];

// 状态标签渲染
const getStatusBadge = (status: string) => (
  <Badge
    variant={
      PAYABLE_STATUS_VARIANTS[status as keyof typeof PAYABLE_STATUS_VARIANTS] ||
      'secondary'
    }
  >
    {PAYABLE_STATUS_LABELS[status as keyof typeof PAYABLE_STATUS_LABELS] ||
      status}
  </Badge>
);

// 获取付款状态Badge
const getPaymentStatusBadge = (payable: PayableRecordDetail) => {
  const paidAmount = payable.paidAmount || 0;
  const remainingAmount = payable.remainingAmount || 0;

  if (payable.status === 'cancelled') {
    return (
      <span className="text-xs text-[hsl(var(--color-text-tertiary))]">-</span>
    );
  }

  if (remainingAmount <= 0.01) {
    return (
      <Badge
        variant="outline"
        className="border-[hsl(var(--color-success))] bg-[hsl(var(--color-success-light))] text-xs font-medium text-[hsl(var(--color-success))]"
      >
        已付清
      </Badge>
    );
  }

  if (paidAmount > 0) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-yellow-300 bg-yellow-50 text-yellow-700"
      >
        <Clock className="h-3 w-3" />
        部分付款
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-[hsl(var(--color-error))] bg-[hsl(var(--color-error-light))] text-xs font-medium text-[hsl(var(--color-error))]"
    >
      未付款
    </Badge>
  );
};

const PayableLoadingState = () => (
  <div className="flex items-center justify-center py-8">
    <div className="text-muted-foreground">加载中...</div>
  </div>
);

const PayableEmptyState = () => (
  <EmptyState
    icon={<ChineseYuan className="text-muted-foreground h-8 w-8" />}
    title="暂无应付款记录"
    compact
  />
);

interface PayableRowProps {
  payable: PayableRecordDetail;
  onView: (id: string) => void;
  onPayNow: (id: string) => void;
  onDelete: (payable: PayableRecordDetail, event: React.MouseEvent) => void;
}

const PayableIdentifiersCell = ({
  payable,
}: {
  payable: PayableRecordDetail;
}) => (
  <TableCell className="h-8 text-xs">
    <div className="flex flex-col gap-1">
      <span className="font-mono font-semibold text-[hsl(var(--color-primary))]">
        <CopyableText text={payable.payableNumber} />
      </span>
      {payable.sourceNumber && (
        <span className="text-[hsl(var(--color-text-tertiary))]">
          来源: <CopyableText text={payable.sourceNumber} />
        </span>
      )}
    </div>
  </TableCell>
);

const PayableSupplierCell = ({ payable }: { payable: PayableRecordDetail }) => (
  <TableCell className="h-8 text-xs">
    <div className="flex flex-col gap-1">
      <span className="font-medium text-[hsl(var(--color-text-primary))]">
        {payable.supplier?.name || '未知供应商'}
      </span>
      {payable.supplier?.phone && (
        <span className="text-[hsl(var(--color-text-tertiary))]">
          {payable.supplier.phone}
        </span>
      )}
    </div>
  </TableCell>
);

const PayableSourceTypeCell = ({
  payable,
}: {
  payable: PayableRecordDetail;
}) => (
  <TableCell className="h-8 text-xs text-[hsl(var(--color-text-secondary))]">
    {payable.sourceType ? (
      <Badge variant="outline" className="text-xs">
        {PAYABLE_SOURCE_TYPE_LABELS[payable.sourceType]}
      </Badge>
    ) : (
      <span className="text-[hsl(var(--color-text-tertiary))]">-</span>
    )}
  </TableCell>
);

const PayableStatusCell = ({ status }: { status: string }) => (
  <TableCell className="h-8 text-xs">{getStatusBadge(status)}</TableCell>
);

const PayableAmountCell = ({
  value,
  className,
}: {
  value?: number;
  className?: string;
}) => (
  <TableCell className={`h-8 text-right text-xs ${className ?? ''}`.trim()}>
    {formatCurrency(value ?? 0)}
  </TableCell>
);

const PayablePaymentStatusCell = ({
  payable,
}: {
  payable: PayableRecordDetail;
}) => (
  <TableCell className="h-8 text-xs">
    {getPaymentStatusBadge(payable)}
  </TableCell>
);

const PayableDueDateCell = ({ payable }: { payable: PayableRecordDetail }) => {
  if (!payable.dueDate) {
    return (
      <TableCell className="h-8 text-xs text-[hsl(var(--color-text-secondary))]">
        <span className="text-[hsl(var(--color-text-tertiary))]">-</span>
      </TableCell>
    );
  }

  const isOverdue =
    new Date(payable.dueDate) < new Date() &&
    (payable.remainingAmount ?? 0) > 0;
  const dueDateClassName = isOverdue
    ? 'text-red-600 font-medium'
    : 'font-medium';

  return (
    <TableCell className="h-8 text-xs text-[hsl(var(--color-text-secondary))]">
      <span className={dueDateClassName}>
        {formatDateTime(payable.dueDate, 'yyyy-MM-dd')}
      </span>
    </TableCell>
  );
};

const PayableCreatedAtCell = ({ createdAt }: { createdAt: Date | string }) => (
  <TableCell className="h-8 text-xs text-[hsl(var(--color-text-secondary))]">
    <RelativeTime date={createdAt} />
  </TableCell>
);

interface PayableActionsCellProps {
  payable: PayableRecordDetail;
  onPayNow: (id: string) => void;
  onView: (id: string) => void;
  onDelete: (payable: PayableRecordDetail, event: React.MouseEvent) => void;
}

const PayableActionsCell: React.FC<PayableActionsCellProps> = ({
  payable,
  onPayNow,
  onView,
  onDelete,
}) => (
  <TableCell className="h-8 text-xs">
    <div className="flex items-center justify-center gap-1">
      {payable.remainingAmount > 0 && payable.status !== 'cancelled' && (
        <Button
          variant="default"
          size="sm"
          onClick={event => {
            event.stopPropagation();
            onPayNow(payable.id);
          }}
          className="h-6 bg-orange-600 px-2 text-xs text-white hover:bg-orange-700"
        >
          立即付款
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={event => event.stopPropagation()}
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem
            onClick={event => {
              event.stopPropagation();
              onView(payable.id);
            }}
            className="text-xs"
          >
            <Eye className="mr-1 h-3 w-3" />
            查看详情
          </DropdownMenuItem>
          {payable.status === 'cancelled' && (
            <DropdownMenuItem
              onClick={event => onDelete(payable, event)}
              className="text-xs text-[hsl(var(--color-error))]"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              删除
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </TableCell>
);

function PayableRow({ payable, onView, onPayNow, onDelete }: PayableRowProps) {
  return (
    <TableRow
      className="hover:bg-muted/50 cursor-pointer"
      onClick={() => onView(payable.id)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onView(payable.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <PayableIdentifiersCell payable={payable} />
      <PayableSupplierCell payable={payable} />
      <PayableSourceTypeCell payable={payable} />
      <PayableStatusCell status={payable.status} />
      <PayableAmountCell
        value={payable.payableAmount}
        className="font-semibold text-[hsl(var(--color-text-primary))]"
      />
      <PayableAmountCell
        value={payable.paidAmount}
        className="font-medium text-green-600"
      />
      <PayableAmountCell
        value={payable.remainingAmount}
        className="font-medium text-amber-600"
      />
      <PayablePaymentStatusCell payable={payable} />
      <PayableDueDateCell payable={payable} />
      <PayableCreatedAtCell createdAt={payable.createdAt} />
      <PayableActionsCell
        payable={payable}
        onPayNow={onPayNow}
        onView={onView}
        onDelete={onDelete}
      />
    </TableRow>
  );
}

function PayableCard({ payable, onView, onPayNow, onDelete }: PayableRowProps) {
  const isOverdue =
    payable.dueDate &&
    new Date(payable.dueDate) < new Date() &&
    (payable.remainingAmount ?? 0) > 0;

  return (
    <div
      className="bg-card rounded-lg border p-3 shadow-[var(--shadow-light)] sm:p-4"
      role="button"
      tabIndex={0}
      onClick={() => onView(payable.id)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onView(payable.id);
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <span>应付单号</span>
            <span className="font-mono font-semibold text-[hsl(var(--color-primary))]">
              <CopyableText text={payable.payableNumber} />
            </span>
          </div>
          {payable.sourceNumber && (
            <div className="text-xs text-[hsl(var(--color-text-tertiary))]">
              来源：
              <CopyableText text={payable.sourceNumber} />
            </div>
          )}
          <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
            {payable.supplier?.name || '未知供应商'}
          </div>
          {payable.supplier?.phone && (
            <div className="text-xs text-[hsl(var(--color-text-tertiary))]">
              {payable.supplier.phone}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          {getStatusBadge(payable.status)}
          <span className="text-[hsl(var(--color-text-secondary))]">
            {payable.sourceType
              ? PAYABLE_SOURCE_TYPE_LABELS[payable.sourceType]
              : '其他来源'}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-xs sm:text-sm">
        <div className="space-y-1">
          <div className="text-muted-foreground">应付金额</div>
          <div className="font-semibold text-[hsl(var(--color-text-primary))]">
            {formatCurrency(payable.payableAmount ?? 0)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">已付金额</div>
          <div className="font-medium text-green-600">
            {formatCurrency(payable.paidAmount ?? 0)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">待付金额</div>
          <div className="font-medium text-amber-600">
            {formatCurrency(payable.remainingAmount ?? 0)}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[hsl(var(--color-text-secondary))]">
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <span>到期：</span>
          {payable.dueDate ? (
            <span
              className={isOverdue ? 'font-medium text-red-600' : 'font-medium'}
            >
              {formatDateTime(payable.dueDate, 'yyyy-MM-dd')}
            </span>
          ) : (
            <span className="text-[hsl(var(--color-text-tertiary))]">-</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <span>创建：</span>
          <RelativeTime date={payable.createdAt} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={event => {
              event.stopPropagation();
              onView(payable.id);
            }}
          >
            <Eye className="mr-1 h-3.5 w-3.5" />
            查看详情
          </Button>

          {payable.remainingAmount > 0 && payable.status !== 'cancelled' && (
            <Button
              variant="default"
              size="sm"
              className="h-8 bg-orange-600 px-3 text-xs text-white hover:bg-orange-700"
              onClick={event => {
                event.stopPropagation();
                onPayNow(payable.id);
              }}
            >
              立即付款
            </Button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={event => event.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem
              onClick={event => {
                event.stopPropagation();
                onView(payable.id);
              }}
              className="text-xs"
            >
              <Eye className="mr-1 h-3 w-3" />
              查看详情
            </DropdownMenuItem>
            {payable.status === 'cancelled' && (
              <DropdownMenuItem
                onClick={event => onDelete(payable, event)}
                className="text-xs text-[hsl(var(--color-error))]"
              >
                <Trash2 className="mr-1 h-3 w-3" />
                删除
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface PayableDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  payable: PayableRecordDetail | null;
}

const PayableDeleteDialog: React.FC<PayableDeleteDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  payable,
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>确认删除应付款记录</AlertDialogTitle>
        <AlertDialogDescription>
          确定要删除应付款记录
          <span className="font-semibold">{payable?.payableNumber}</span>
          吗？此操作不可撤销。
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          确认删除
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export function PayableTableList({
  items,
  isLoading,
  onView,
  onPayNow,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [payablePendingDelete, setPayablePendingDelete] =
    React.useState<PayableRecordDetail | null>(null);

  // ✅ 使用 TanStack Query mutation 实现删除功能
  const deleteMutation = useMutation({
    mutationFn: async (payableId: string) => {
      const response = await fetch(
        `/api/finance/payables/${payableId}`,
        getCsrfTokenHeader({
          method: 'DELETE',
        })
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除应付款记录失败');
      }

      return response.json();
    },
    onSuccess: (_data, _variables, _context) => {
      // ✅ 删除成功后刷新列表
      queryClient.invalidateQueries({ queryKey: ['payables', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['payables', 'statistics'] });

      toast({
        title: '删除成功',
        description: `应付款记录 ${payablePendingDelete?.payableNumber} 已删除`,
        variant: 'success',
      });

      setDeleteConfirmOpen(false);
      setPayablePendingDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: '删除失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDeleteDialogOpenChange = React.useCallback((open: boolean) => {
    setDeleteConfirmOpen(open);
    if (!open) {
      setPayablePendingDelete(null);
    }
  }, []);

  const handleDeletePayable = React.useCallback(() => {
    if (!payablePendingDelete) {
      return;
    }

    // ✅ 调用真正的删除 API
    deleteMutation.mutate(payablePendingDelete.id);
  }, [payablePendingDelete, deleteMutation]);

  const handleDeletePayableClick = React.useCallback(
    (payable: PayableRecordDetail, event: React.MouseEvent) => {
      event.stopPropagation();
      setPayablePendingDelete(payable);
      setDeleteConfirmOpen(true);
    },
    []
  );

  if (isLoading) {
    return <PayableLoadingState />;
  }

  if (!items?.length) {
    return <PayableEmptyState />;
  }

  return (
    <>
      {/* 桌面端：宽表格 + 横向滚动 */}
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {TABLE_HEADERS.map(header => (
                <TableHead
                  key={header.key}
                  className={`h-8 text-xs font-medium${
                    header.align === 'right'
                      ? 'text-right'
                      : header.align === 'center'
                        ? 'text-center'
                        : ''
                  }`}
                >
                  {header.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(payable => (
              <PayableRow
                key={payable.id}
                payable={payable}
                onView={onView}
                onPayNow={onPayNow}
                onDelete={handleDeletePayableClick}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 移动端：卡片列表 */}
      <div className="space-y-3 md:hidden">
        {items.map(payable => (
          <PayableCard
            key={payable.id}
            payable={payable}
            onView={onView}
            onPayNow={onPayNow}
            onDelete={handleDeletePayableClick}
          />
        ))}
      </div>

      <PayableDeleteDialog
        open={deleteConfirmOpen}
        payable={payablePendingDelete}
        onOpenChange={handleDeleteDialogOpenChange}
        onConfirm={handleDeletePayable}
      />
    </>
  );
}
