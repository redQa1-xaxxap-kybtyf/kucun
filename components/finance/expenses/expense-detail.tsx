'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Edit, FileText, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import { CopyableText } from '@/components/common/copyable-text';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { can } from '@/lib/auth/permissions';
import { queryKeys } from '@/lib/queryKeys';
import {
  EXPENSE_RELATED_TYPE_LABELS,
  EXPENSE_STATUS_LABELS,
  EXPENSE_TYPE_LABELS,
  type ExpenseRecord,
} from '@/lib/types/expense';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { formatCurrency } from '@/lib/utils/format';

interface ExpenseDetailClientProps {
  expense: ExpenseRecord;
}

export function ExpenseDetailClient({ expense }: ExpenseDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const hasManagePermission = React.useMemo(
    () => can(session?.user ?? null, 'finance:manage'),
    [session?.user]
  );

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/finance/expenses/${expense.id}`,
        getCsrfTokenHeader({
          method: 'DELETE',
        })
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除失败');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '删除成功',
        description: '费用记录已成功删除',
      });

      // ✅ 使用 refetchQueries 强制立即刷新，确保用户删除费用后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.finance.expenses(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.finance.expensesStatistics(),
        type: 'active',
      });

      router.push('/finance/expenses');
    },
    onError: (error: Error) => {
      toast({
        title: '删除失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
    setDeleteDialogOpen(false);
  };

  const getExpenseTypeBadgeVariant = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      shipping: 'default',
      storage: 'secondary',
      labor: 'outline',
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Button>
        </div>

        {hasManagePermission && (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/finance/expenses/${expense.id}/edit`)
              }
              className="shadow-[var(--shadow-light)] transition-all hover:shadow-[var(--shadow-medium)]"
            >
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={
                deleteMutation.isPending || expense.status === 'approved'
              }
              className="shadow-[var(--shadow-light)] transition-all hover:shadow-[var(--shadow-medium)]"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </Button>
          </div>
        )}
      </div>

      {/* 基本信息卡片 */}
      <Card className="card-shadow-medium border border-[hsl(var(--color-border-primary))]">
        <CardHeader className="bg-[hsl(var(--color-bg-secondary))]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-[hsl(var(--color-text-primary))]">
              基本信息
            </CardTitle>
            <div className="flex items-center gap-2">
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
        <CardContent className="space-y-6 pt-6">
          {/* 费用金额 - 突出显示 */}
          <div className="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-6 dark:from-green-950/20 dark:to-emerald-950/20">
            <div className="mb-2 text-sm font-medium text-[hsl(var(--color-text-secondary))]">
              费用金额
            </div>
            <div className="flex items-center gap-3">
              <ChineseYuan className="h-6 w-6 text-green-600" />
              <div className="text-4xl font-bold text-green-600">
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
                {format(new Date(expense.expenseDate), 'yyyy-MM-dd')}
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
            <CardTitle>备注信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm whitespace-pre-wrap">{expense.remarks}</div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除费用记录 <strong>{expense.expenseNumber}</strong> 吗？
              <br />
              <span className="text-destructive font-medium">
                此操作不可撤销，删除后将无法恢复费用记录数据。
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
