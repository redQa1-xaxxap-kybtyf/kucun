'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  ArrowUpDown,
  Eye,
  FileText,
  Package,
  Pencil,
  ShoppingCart,
  Trash2,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { CopyableText } from '@/components/common/copyable-text';
import { RelativeTime } from '@/components/common/relative-time';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { invalidateFinanceCaches } from '@/lib/cache/invalidation-helpers';
import { queryKeys } from '@/lib/queryKeys';
import {
  EXPENSE_RELATED_TYPE_LABELS,
  EXPENSE_STATUS_LABELS,
  EXPENSE_TYPE_LABELS,
  type ExpenseQueryParams,
  type ExpenseRecord,
} from '@/lib/types/expense';
import { cn } from '@/lib/utils';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { formatCurrency } from '@/lib/utils/format';

import { ExpenseRecordActionDialog } from './expense-record-action-dialog';

const getStatusBadgeVariant = (status: string) => {
  const variants: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600 border-slate-200',
    approved: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
  };
  return variants[status] || 'bg-slate-100 text-slate-600 border-slate-200';
};

const getRelatedTypeIcon = (type: string) => {
  switch (type) {
    case 'sales_order':
      return <ShoppingCart className="h-3 w-3" />;
    case 'purchase_order':
      return <ShoppingCart className="h-3 w-3" />;
    case 'inbound':
      return <Package className="h-3 w-3" />;
    case 'outbound':
      return <Truck className="h-3 w-3" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
};

interface ExpenseListProps {
  filters: ExpenseQueryParams;
  onPageChange: (page: number) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  hasManagePermission: boolean;
}

export function ExpenseList({
  filters,
  onPageChange,
  onSortChange,
  hasManagePermission,
}: ExpenseListProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [actionTarget, setActionTarget] = React.useState<{
    expense: ExpenseRecord;
    mode: 'delete' | 'void';
  } | null>(null);
  const [approveTarget, setApproveTarget] =
    React.useState<ExpenseRecord | null>(null);
  const [voidReason, setVoidReason] = React.useState('');

  // 获取费用记录列表
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.finance.expensesList(filters),
    // ✅ 覆盖全局设置：每次挂载时都重新拉取，确保从创建/编辑页面返回后列表是最新的
    refetchOnMount: 'always',
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (filters.page) searchParams.set('page', filters.page.toString());
      if (filters.pageSize)
        searchParams.set('pageSize', filters.pageSize.toString());
      if (filters.search) searchParams.set('search', filters.search);
      if (filters.expenseType)
        searchParams.set('expenseType', filters.expenseType);
      if (filters.startDate) searchParams.set('startDate', filters.startDate);
      if (filters.endDate) searchParams.set('endDate', filters.endDate);
      if (filters.relatedType)
        searchParams.set('relatedType', filters.relatedType);
      if (filters.includeTest) searchParams.set('includeTest', 'true');
      if (filters.includeVoided) searchParams.set('includeVoided', 'true');
      if (filters.sortBy) searchParams.set('sortBy', filters.sortBy);
      if (filters.sortOrder) searchParams.set('sortOrder', filters.sortOrder);

      const response = await fetch(
        `/api/finance/expenses?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('获取费用记录失败');
      }

      const result = await response.json();
      return result.data;
    },
  });

  // 审核费用记录
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        `/api/finance/expenses/${id}/approve`,
        getCsrfTokenHeader({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || '审核失败');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.expenses(),
        exact: false,
      });
      invalidateFinanceCaches(queryClient);
    },
    onSettled: () => {
      setApproveTarget(null);
    },
  });

  // 删除费用记录
  const deleteMutation = useMutation({
    mutationFn: async ({
      expense,
      mode,
    }: {
      expense: ExpenseRecord;
      mode: 'delete' | 'void';
    }) => {
      const response = await fetch(
        `/api/finance/expenses/${expense.id}`,
        mode === 'void'
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
            })
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || (mode === 'void' ? '作废失败' : '删除失败'));
      }

      return response.json();
    },
    onSuccess: (result, variables) => {
      // ✅ P0修复: 使用 exact: false 失效所有以 ['finance', 'expenses'] 开头的查询
      // 修复前：只匹配 ['finance', 'expenses'] 精确键，无法匹配列表和统计查询
      // 修复后：匹配所有 ['finance', 'expenses', ...] 查询，包括列表和统计
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.expenses(),
        exact: false,
      });
      invalidateFinanceCaches(queryClient);
      setActionTarget(null);
      setVoidReason('');
      toast({
        title: variables.mode === 'void' ? '费用已作废' : '删除成功',
        description:
          result?.message ||
          (variables.mode === 'void'
            ? '这笔费用已作废，不会再进入正式报表。'
            : '这笔草稿费用已删除。'),
      });
    },
    onError: (error: Error, variables) => {
      toast({
        title: variables.mode === 'void' ? '作废失败' : '删除失败',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setActionTarget(null);
      setVoidReason('');
    },
  });

  // 处理删除/作废
  const handleAction = React.useCallback((expense: ExpenseRecord) => {
    if (expense.status === 'cancelled') {
      return;
    }

    setVoidReason('');
    setActionTarget({
      expense,
      mode: expense.status === 'approved' ? 'void' : 'delete',
    });
  }, []);

  // 处理排序
  const handleSort = React.useCallback(
    (sortBy: string) => {
      const newSortOrder =
        filters.sortBy === sortBy && filters.sortOrder === 'desc'
          ? 'asc'
          : 'desc';
      onSortChange(sortBy, newSortOrder);
    },
    [filters.sortBy, filters.sortOrder, onSortChange]
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>费用列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>费用列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">
            加载失败，请稍后重试
          </div>
        </CardContent>
      </Card>
    );
  }

  const { records = [], pagination } = data || {};

  return (
    <>
      <Card className="overflow-hidden rounded-md border border-border shadow-sm">
        <CardHeader className="border-b border-slate-50 bg-slate-50/30">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <CardTitle className="border-l-4 border-slate-900 pl-3 text-lg font-semibold tracking-tight text-slate-900">
                费用列表
                {pagination && (
                  <span className="ml-3 text-xs font-medium text-slate-500">
                    共 {pagination.total} 条
                  </span>
                )}
              </CardTitle>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                只有“已审核入账”的费用会进入月报、年报和利润分析。
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              暂无费用
            </div>
          ) : (
            <>
              {/* 桌面端：表格视图 */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead>
                        单号
                      </TableHead>
                      <TableHead className="text-center">
                        分类/状态
                      </TableHead>
                      <TableHead>
                        费用事宜
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('expenseAmount')}
                          className="text-inherit"
                        >
                          收支金额
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('expenseDate')}
                          className="text-inherit"
                        >
                          发生日期
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        关联业务
                      </TableHead>
                      <TableHead className="text-right">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((expense: ExpenseRecord) => (
                      <TableRow
                        key={expense.id}
                        className="group transition-colors hover:bg-slate-50/30"
                      >
                        <TableCell>
                          <div className="font-mono text-xs font-semibold text-slate-900">
                            <CopyableText text={expense.expenseNumber} />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="border-slate-200 text-[10px] font-semibold text-slate-500"
                            >
                              {EXPENSE_TYPE_LABELS[expense.expenseType]}
                            </Badge>
                            <span
                              className={cn(
                                'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-semibold',
                                getStatusBadgeVariant(expense.status)
                              )}
                            >
                              {EXPENSE_STATUS_LABELS[expense.status]}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="mb-1 text-sm leading-tight font-semibold text-slate-900">
                              {expense.expenseName}
                            </span>
                            {expense.remarks && (
                              <span className="max-w-[200px] truncate text-xs font-bold text-slate-400">
                                {expense.remarks}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-base font-semibold text-slate-900">
                            {formatCurrency(expense.expenseAmount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs font-bold text-slate-600">
                            <RelativeTime date={expense.expenseDate} />
                          </span>
                        </TableCell>
                        <TableCell>
                          {expense.relatedType && expense.relatedNumber ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                                {getRelatedTypeIcon(expense.relatedType)}
                                <CopyableText text={expense.relatedNumber} />
                              </div>
                              <div className="text-[10px] font-bold text-slate-400">
                                {
                                  EXPENSE_RELATED_TYPE_LABELS[
                                    expense.relatedType as keyof typeof EXPENSE_RELATED_TYPE_LABELS
                                  ]
                                }
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-slate-300">
                              未关联业务
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Link href={`/finance/expenses/${expense.id}`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-slate-900"
                                aria-label={`查看费用 ${expense.expenseNumber}`}
                                title="查看详情"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            {hasManagePermission && (
                              <>
                                <Link
                                  href={`/finance/expenses/${expense.id}/edit`}
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-slate-900"
                                    aria-label={`编辑费用 ${expense.expenseNumber}`}
                                    title="编辑费用"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </Link>
                                {expense.status === 'draft' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                    onClick={() => setApproveTarget(expense)}
                                    disabled={approveMutation.isPending}
                                    aria-label={`审核费用 ${expense.expenseNumber}`}
                                  >
                                    审核入账
                                  </Button>
                                )}
                                {expense.status === 'draft' ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-300 hover:text-rose-600"
                                    onClick={() => handleAction(expense)}
                                    disabled={deleteMutation.isPending}
                                    aria-label={`删除费用 ${expense.expenseNumber}`}
                                    title="删除草稿费用"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : null}
                                {expense.status === 'approved' ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-300 hover:text-amber-600"
                                    onClick={() => handleAction(expense)}
                                    disabled={deleteMutation.isPending}
                                    aria-label={`作废费用 ${expense.expenseNumber}`}
                                    title="作废已审核费用"
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端：卡片列表视图 */}
              <div className="mt-4 space-y-3 md:hidden">
                {records.map((expense: ExpenseRecord) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    hasManagePermission={hasManagePermission}
                    onAction={handleAction}
                    onApprove={exp => setApproveTarget(exp)}
                  />
                ))}
              </div>

              {/* 分页 */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-muted-foreground text-sm">
                    第 {pagination.page} 页，共 {pagination.totalPages} 页
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {actionTarget ? (
        <ExpenseRecordActionDialog
          open={!!actionTarget}
          onOpenChange={open => {
            if (!open) {
              setActionTarget(null);
              setVoidReason('');
            }
          }}
          mode={actionTarget.mode}
          expenseNumber={actionTarget.expense.expenseNumber}
          isSubmitting={deleteMutation.isPending}
          reason={voidReason}
          onReasonChange={setVoidReason}
          onConfirm={() => {
            deleteMutation.mutate(actionTarget);
          }}
        />
      ) : null}

      <AlertDialog
        open={!!approveTarget}
        onOpenChange={open => {
          if (!open) {
            setApproveTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认审核</AlertDialogTitle>
            <AlertDialogDescription>
              {approveTarget
                ? `确定要审核费用 ${approveTarget.expenseNumber} 吗？审核后将不再允许修改类型、金额、日期和关联业务，只能修改备注。`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (approveTarget) {
                  approveMutation.mutate(approveTarget.id);
                }
              }}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? '审核中...' : '确认审核'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ExpenseCard({
  expense,
  hasManagePermission,
  onAction,
  onApprove,
}: {
  expense: ExpenseRecord;
  hasManagePermission: boolean;
  onAction: (expense: ExpenseRecord) => void;
  onApprove: (expense: ExpenseRecord) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-md border border-slate-100 bg-white p-5 shadow-sm">
      <div>
        <div className="mb-4 flex items-start justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-slate-400">
              流水编号
            </div>
            <div className="font-mono text-xs leading-none font-semibold text-slate-900">
              <CopyableText text={expense.expenseNumber} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge
              variant="outline"
              className="border-slate-200 px-1.5 py-0 text-[9px] font-semibold text-slate-500"
            >
              {EXPENSE_TYPE_LABELS[expense.expenseType]}
            </Badge>
            <span
              className={cn(
                'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-semibold',
                getStatusBadgeVariant(expense.status)
              )}
            >
              {EXPENSE_STATUS_LABELS[expense.status]}
            </span>
          </div>
        </div>

        <div className="mb-5">
          <h4 className="mb-1 text-sm leading-tight font-semibold text-slate-900">
            {expense.expenseName}
          </h4>
          {expense.remarks && (
            <p className="line-clamp-2 text-xs font-bold text-slate-400">
              {expense.remarks}
            </p>
          )}
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 border-t border-slate-50 pt-4">
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-slate-400">
              收支金额
            </div>
            <div className="font-mono text-lg font-semibold text-slate-900">
              {formatCurrency(expense.expenseAmount)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-slate-400">
              业务日期
            </div>
            <div className="text-xs font-semibold text-slate-600">
              <RelativeTime date={expense.expenseDate} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          {expense.relatedType && expense.relatedNumber ? (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-50 text-slate-400">
                {getRelatedTypeIcon(expense.relatedType)}
              </div>
              <div className="flex flex-col">
                <span className="mb-1 text-[10px] leading-none font-semibold text-slate-900">
                  {expense.relatedNumber}
                </span>
                <span className="line-clamp-1 text-[9px] font-bold text-slate-400">
                  {
                    EXPENSE_RELATED_TYPE_LABELS[
                      expense.relatedType as keyof typeof EXPENSE_RELATED_TYPE_LABELS
                    ]
                  }
                </span>
              </div>
            </div>
          ) : (
            <span className="text-[10px] font-semibold text-slate-300">
              未关联资产
            </span>
          )}

          <div className="flex gap-1">
            <Link href={`/finance/expenses/${expense.id}`}>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-slate-400"
                aria-label={`查看费用 ${expense.expenseNumber}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            {hasManagePermission && expense.status !== 'cancelled' && (
              <Link href={`/finance/expenses/${expense.id}/edit`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-slate-400"
                  aria-label={`编辑费用 ${expense.expenseNumber}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {hasManagePermission &&
        (expense.status === 'draft' || expense.status === 'approved') ? (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
            {expense.status === 'draft' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onApprove(expense)}
                className="h-8 text-xs font-bold"
                aria-label={`审核费用 ${expense.expenseNumber}`}
              >
                审核入账
              </Button>
            ) : null}
            {expense.status === 'draft' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAction(expense)}
                className="h-8 text-xs font-bold text-rose-600"
                aria-label={`删除费用 ${expense.expenseNumber}`}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                删除
              </Button>
            ) : null}
            {expense.status === 'approved' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAction(expense)}
                className="h-8 text-xs font-bold text-amber-700"
                aria-label={`作废费用 ${expense.expenseNumber}`}
              >
                <Ban className="mr-1 h-3.5 w-3.5" />
                作废
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
