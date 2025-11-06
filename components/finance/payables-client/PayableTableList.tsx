'use client';
import { ChineseYuan } from '@/components/icons/chinese-yuan';

import { Clock, Eye, MoreHorizontal, Trash2 } from 'lucide-react';
import * as React from 'react';

import { EmptyState } from '@/components/common/empty-state';
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
        {payable.payableNumber}
      </span>
      {payable.sourceNumber && (
        <span className="text-[hsl(var(--color-text-tertiary))]">
          来源: {payable.sourceNumber}
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
    {formatDateTime(createdAt, 'yyyy-MM-dd HH:mm')}
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [payablePendingDelete, setPayablePendingDelete] =
    React.useState<PayableRecordDetail | null>(null);

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

    toast({
      title: '删除成功',
      description: `应付款记录 ${payablePendingDelete.payableNumber} 已删除`,
      variant: 'success',
    });

    setDeleteConfirmOpen(false);
    setPayablePendingDelete(null);
  }, [payablePendingDelete, toast]);

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
      <div className="rounded-md border">
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

      <PayableDeleteDialog
        open={deleteConfirmOpen}
        payable={payablePendingDelete}
        onOpenChange={handleDeleteDialogOpenChange}
        onConfirm={handleDeletePayable}
      />
    </>
  );
}
