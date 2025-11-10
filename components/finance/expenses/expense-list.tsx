'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpDown, Eye, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

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
import { queryKeys } from '@/lib/queryKeys';
import {
  EXPENSE_RELATED_TYPE_LABELS,
  EXPENSE_TYPE_LABELS,
  type ExpenseQueryParams,
  type ExpenseRecord,
} from '@/lib/types/expense';
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

  // 获取费用记录列表
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.finance.expensesList(filters),
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

  // 删除费用记录
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/finance/expenses/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除失败');
      }

      return response.json();
    },
    onSuccess: () => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户删除费用后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.finance.expenses(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.finance.expensesStatistics(),
        type: 'active',
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

  // 格式化日期
  const formatDate = (dateString: string) => dateString.split('T')[0];

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
                      <TableHead className="w-[150px] text-center">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((expense: ExpenseRecord) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">
                          {expense.expenseNumber}
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
                        <TableCell>{expense.expenseName}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(expense.expenseAmount)}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatDate(expense.expenseDate)}
                        </TableCell>
                        <TableCell>
                          {expense.relatedType && expense.relatedNumber ? (
                            <div className="text-sm">
                              <div className="text-muted-foreground">
                                {
                                  EXPENSE_RELATED_TYPE_LABELS[
                                    expense.relatedType as keyof typeof EXPENSE_RELATED_TYPE_LABELS
                                  ]
                                }
                              </div>
                              <div className="font-medium">
                                {expense.relatedNumber}
                              </div>
                              {expense.expenseType === 'shipping' &&
                                expense.containerNumber && (
                                  <div className="text-muted-foreground text-xs">
                                    集装箱号：{expense.containerNumber}
                                  </div>
                                )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(expense)}
                                  disabled={deleteMutation.isPending}
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
    </>
  );
}
