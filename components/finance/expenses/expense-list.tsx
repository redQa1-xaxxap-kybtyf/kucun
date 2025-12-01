'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import {
  EXPENSE_RELATED_TYPE_LABELS,
  EXPENSE_STATUS_LABELS,
  EXPENSE_TYPE_LABELS,
  type ExpenseQueryParams,
  type ExpenseRecord,
} from '@/lib/types/expense';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { formatCurrency } from '@/lib/utils/format';

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
  const [deleteTarget, setDeleteTarget] = React.useState<ExpenseRecord | null>(
    null
  );
  const [approveTarget, setApproveTarget] =
    React.useState<ExpenseRecord | null>(null);

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
      if (filters.expenseType)
        searchParams.set('expenseType', filters.expenseType);
      if (filters.startDate) searchParams.set('startDate', filters.startDate);
      if (filters.endDate) searchParams.set('endDate', filters.endDate);
      if (filters.relatedType)
        searchParams.set('relatedType', filters.relatedType);
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
    },
    onSettled: () => {
      setApproveTarget(null);
    },
  });

  // 删除费用记录
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        `/api/finance/expenses/${id}`,
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
      // ✅ P0修复: 使用 exact: false 失效所有以 ['finance', 'expenses'] 开头的查询
      // 修复前：只匹配 ['finance', 'expenses'] 精确键，无法匹配列表和统计查询
      // 修复后：匹配所有 ['finance', 'expenses', ...] 查询，包括列表和统计
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.expenses(),
        exact: false,
      });
    },
  });

  // 处理删除
  const handleDelete = React.useCallback((expense: ExpenseRecord) => {
    setDeleteTarget(expense);
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

  // 获取费用类型标签颜色
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

  // 获取状态标签样式
  const getStatusBadgeVariant = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      draft: 'secondary',
      approved: 'default', // 使用默认深色表示已审核/生效
      cancelled: 'destructive',
    };
    return variants[status] || 'secondary';
  };

  // 获取关联业务图标
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>费用记录列表</CardTitle>
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
          <CardTitle>费用记录列表</CardTitle>
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
      <Card>
        <CardHeader>
          <CardTitle>
            费用记录列表
            {pagination && (
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                共 {pagination.total} 条记录
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              暂无费用记录
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>费用编号</TableHead>
                      <TableHead className="w-[100px] text-center">
                        费用类型
                      </TableHead>
                      <TableHead className="w-[90px] text-center">
                        状态
                      </TableHead>
                      <TableHead>费用名称</TableHead>
                      <TableHead className="w-[120px] text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('expenseAmount')}
                          className="h-8 w-full justify-end"
                        >
                          费用金额
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="w-[120px] text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('expenseDate')}
                          className="h-8 w-full justify-center"
                        >
                          费用日期
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="w-[150px]">关联业务</TableHead>
                      <TableHead className="w-[220px]">备注</TableHead>
                      <TableHead className="w-[150px] text-center">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((expense: ExpenseRecord) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">
                          <CopyableText text={expense.expenseNumber} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={getExpenseTypeBadgeVariant(
                              expense.expenseType
                            )}
                          >
                            {EXPENSE_TYPE_LABELS[expense.expenseType]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={getStatusBadgeVariant(expense.status)}
                            className={
                              expense.status === 'approved'
                                ? 'bg-green-600 hover:bg-green-700'
                                : ''
                            }
                          >
                            {EXPENSE_STATUS_LABELS[expense.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{expense.expenseName}</TableCell>
                        <TableCell className="text-right font-mono text-base font-bold">
                          {formatCurrency(expense.expenseAmount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <RelativeTime date={expense.expenseDate} />
                        </TableCell>
                        <TableCell>
                          {expense.relatedType && expense.relatedNumber ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 font-medium">
                                {getRelatedTypeIcon(expense.relatedType)}
                                <CopyableText text={expense.relatedNumber} />
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {
                                  EXPENSE_RELATED_TYPE_LABELS[
                                    expense.relatedType as keyof typeof EXPENSE_RELATED_TYPE_LABELS
                                  ]
                                }
                                {expense.expenseType === 'shipping' &&
                                  expense.containerNumber && (
                                    <span className="ml-1">
                                      (柜号:
                                      <CopyableText
                                        text={expense.containerNumber}
                                        className="ml-0.5 inline-flex"
                                        iconSize="sm"
                                      />
                                      )
                                    </span>
                                  )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">−</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {expense.remarks &&
                          expense.remarks.trim().length > 0 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="max-w-[180px] truncate text-sm">
                                    {expense.remarks}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-[300px] break-words">
                                    {expense.remarks}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link href={`/finance/expenses/${expense.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            {hasManagePermission && (
                              <>
                                <Link
                                  href={`/finance/expenses/${expense.id}/edit`}
                                >
                                  <Button variant="ghost" size="sm">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </Link>
                                {expense.status === 'draft' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setApproveTarget(expense)}
                                    disabled={approveMutation.isPending}
                                  >
                                    审核
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(expense)}
                                  disabled={
                                    deleteMutation.isPending ||
                                    expense.status === 'approved'
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `确定要删除费用记录 ${deleteTarget.expenseNumber} 吗？此操作不可恢复。`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id);
                }
                setDeleteTarget(null);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                ? `确定要审核费用记录 ${approveTarget.expenseNumber} 吗？审核后将不再允许修改类型、金额、日期和关联业务，只能修改备注。`
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
