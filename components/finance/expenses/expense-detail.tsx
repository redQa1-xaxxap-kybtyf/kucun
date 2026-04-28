'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Calendar, Edit, FileText, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { CopyableText } from '@/components/common/copyable-text';
import { RelativeTime } from '@/components/common/relative-time';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { invalidateFinanceCaches } from '@/lib/cache/invalidation-helpers';
import { queryKeys } from '@/lib/queryKeys';
import {
  EXPENSE_RELATED_TYPE_LABELS,
  EXPENSE_STATUS_LABELS,
  EXPENSE_TYPE_LABELS,
  type ExpenseRecord,
} from '@/lib/types/expense';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { formatDate } from '@/lib/utils/datetime';
import { formatCurrency } from '@/lib/utils/format';

interface ExpenseDetailClientProps {
  expense: ExpenseRecord;
  hasManagePermission?: boolean;
}

const ExpenseRecordActionDialog = dynamic(
  () =>
    import('./expense-record-action-dialog').then(
      mod => mod.ExpenseRecordActionDialog
    ),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-sm rounded-md bg-[hsl(var(--color-bg-card))] p-6 shadow-sm">
          <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
            正在加载...
          </div>
        </div>
      </div>
    ),
  }
);

export function ExpenseDetailClient({
  expense,
  hasManagePermission = false,
}: ExpenseDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [actionDialogOpen, setActionDialogOpen] = React.useState(false);
  const [voidReason, setVoidReason] = React.useState('');
  const isDraftExpense = expense.status === 'draft';
  const isApprovedExpense = expense.status === 'approved';
  const isCancelledExpense = expense.status === 'cancelled';

  const removeMutation = useMutation({
    mutationFn: async () => {
      const requestInit = isApprovedExpense
        ? getCsrfTokenHeader({
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...(voidReason.trim()
                ? { voidReason: voidReason.trim().slice(0, 64) }
                : {}),
            }),
          })
        : getCsrfTokenHeader({
            method: 'DELETE',
          });
      const response = await fetch(
        `/api/finance/expenses/${expense.id}`,
        requestInit
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || (isApprovedExpense ? '作废失败' : '删除失败')
        );
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: isApprovedExpense ? '费用已作废' : '删除成功',
        description: isApprovedExpense ? '这笔费用已作废。' : '这笔费用已删除',
      });

      // 刷新费用列表与详情相关查询
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.expenses(),
        exact: false,
      });
      // 同步刷新财务模块缓存，避免月报/年报/盈亏分析仍显示旧值
      invalidateFinanceCaches(queryClient);

      router.push('/finance/expenses');
    },
    onError: (error: Error) => {
      toast({
        title: isApprovedExpense ? '作废失败' : '删除失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleConfirmAction = React.useCallback(() => {
    removeMutation.mutate();
    setActionDialogOpen(false);
  }, [removeMutation]);

  const getExpenseTypeBadgeVariant = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      shipping: 'default',
      storage: 'secondary',
      labor: 'outline',
      operating: 'default',
      management: 'secondary',
      travel: 'default',
      living: 'secondary',
      loading_unloading: 'outline',
      other: 'secondary',
    };
    return variants[type] || 'default';
  };

  const getRelatedLink = (type: string | null, id: string | null) => {
    if (!type || !id) return null;
    switch (type) {
      case 'purchase_order':
        return `/purchase-orders/${id}`;
      case 'sales_order':
        return `/sales-orders/${id}`;
      case 'return_order':
        return `/return-orders/${id}`;
      default:
        return null;
    }
  };

  const relatedLink = getRelatedLink(
    expense.relatedType || null,
    expense.relatedId || null
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 操作按钮区域 */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回费用管理
          </Button>
        </div>

        {hasManagePermission && (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {!isCancelledExpense ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(`/finance/expenses/${expense.id}/edit`)
                }
                className="shadow-sm"
              >
                <Edit className="mr-2 h-4 w-4" />
                编辑
              </Button>
            ) : null}
            {isDraftExpense ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setActionDialogOpen(true)}
                disabled={removeMutation.isPending}
                className="shadow-sm"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </Button>
            ) : null}
            {isApprovedExpense ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionDialogOpen(true)}
                disabled={removeMutation.isPending}
                className="shadow-sm"
              >
                <Ban className="mr-2 h-4 w-4" />
                作废
              </Button>
            ) : null}
          </div>
        )}
      </div>

      {/* 基本信息卡片 */}
      <Card className="rounded-md border border-[hsl(var(--color-border-primary))] shadow-sm">
        <CardHeader className="bg-[hsl(var(--color-bg-secondary))]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-xl font-bold text-[hsl(var(--color-text-primary))]">
              基本信息
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getExpenseTypeBadgeVariant(expense.expenseType)}>
                {EXPENSE_TYPE_LABELS[expense.expenseType]}
              </Badge>
              {expense.status && (
                <Badge variant="outline">
                  {EXPENSE_STATUS_LABELS[expense.status]}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 sm:space-y-6 sm:pt-6">
          {/* 费用金额 - 突出显示 */}
          <div className="rounded-md border border-green-100 bg-green-50 p-4 sm:p-6">
            <div className="mb-2 text-sm font-medium text-[hsl(var(--color-text-secondary))]">
              费用金额
            </div>
            <div className="flex items-center gap-3">
              <ChineseYuan className="h-6 w-6 text-green-600" />
              <div className="text-3xl font-bold text-green-600 sm:text-4xl">
                {formatCurrency(expense.expenseAmount)}
              </div>
            </div>
          </div>

          <Separator />

          {/* 详细信息网格 */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                费用编号
              </div>
              <div className="text-base font-medium text-[hsl(var(--color-text-primary))]">
                <CopyableText text={expense.expenseNumber} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                费用名称
              </div>
              <div className="text-base font-medium text-[hsl(var(--color-text-primary))]">
                {expense.expenseName}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                费用日期
              </div>
              <div className="flex items-center gap-2 text-base font-medium text-[hsl(var(--color-text-primary))]">
                <Calendar className="h-4 w-4 text-[hsl(var(--color-text-tertiary))]" />
                {formatDate(expense.expenseDate)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                创建时间
              </div>
              <div className="text-base font-medium text-[hsl(var(--color-text-primary))]">
                <RelativeTime date={expense.createdAt} />
              </div>
            </div>

            {expense.updatedAt !== expense.createdAt && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                  更新时间
                </div>
                <div className="text-base font-medium text-[hsl(var(--color-text-primary))]">
                  <RelativeTime date={expense.updatedAt} />
                </div>
              </div>
            )}

            {expense.userName && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                  创建人
                </div>
                <div className="text-base font-medium text-[hsl(var(--color-text-primary))]">
                  {expense.userName}
                </div>
              </div>
            )}

            {expense.voidedAt && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                  作废时间
                </div>
                <div className="text-base font-medium text-[hsl(var(--color-text-primary))]">
                  <RelativeTime date={expense.voidedAt} />
                </div>
              </div>
            )}

            {expense.cancelReason && (
              <div className="space-y-2 md:col-span-2">
                <div className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                  作废说明
                </div>
                <div className="text-base font-medium text-[hsl(var(--color-text-primary))]">
                  {expense.cancelReason}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {expense.relatedType && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              关联业务信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-muted-foreground text-sm">业务类型</div>
                <div className="font-medium">
                  {EXPENSE_RELATED_TYPE_LABELS[expense.relatedType]}
                </div>
              </div>

              {expense.relatedNumber && (
                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm">业务编号</div>
                  <div className="flex items-center gap-2 font-medium">
                    {relatedLink ? (
                      <Link
                        href={relatedLink}
                        className="text-primary hover:text-primary/80 hover:underline"
                      >
                        <CopyableText text={expense.relatedNumber} />
                      </Link>
                    ) : (
                      <CopyableText text={expense.relatedNumber} />
                    )}
                  </div>
                </div>
              )}

              {expense.relatedId && (
                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm">业务编号</div>
                  <div className="text-muted-foreground font-mono text-sm">
                    <CopyableText text={expense.relatedId} />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {expense.remarks && (
        <Card>
          <CardHeader>
            <CardTitle>备注</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm whitespace-pre-wrap">{expense.remarks}</div>
          </CardContent>
        </Card>
      )}

      {actionDialogOpen ? (
        <ExpenseRecordActionDialog
          open={actionDialogOpen}
          onOpenChange={open => {
            setActionDialogOpen(open);
            if (!open) {
              setVoidReason('');
            }
          }}
          mode={isApprovedExpense ? 'void' : 'delete'}
          expenseNumber={expense.expenseNumber}
          isSubmitting={removeMutation.isPending}
          reason={voidReason}
          onReasonChange={setVoidReason}
          onConfirm={handleConfirmAction}
        />
      ) : null}
    </div>
  );
}
